package app.web.note_my_coffee.wear

import android.content.Context
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDateTime
import java.util.Locale
import kotlin.random.Random

private val Context.dataStore by preferencesDataStore(name = "note_my_coffee")

/** 이 워치가 연결된 계정. watchLinks/{watchUid} 문서가 있는 동안만 존재한다. */
data class Link(val ownerUid: String, val ownerName: String)

/**
 * Firebase와 로컬 저장소.
 *
 * 워치는 익명 로그인 계정(watchUid)으로 동작한다. 웹 로그북에서 페어링 코드를
 * 입력하면 watchLinks/{watchUid}가 생기고, 그때부터 주인 uid로 recipes를 쓸 수
 * 있다(firestore.rules). 워치는 주인 기록을 읽을 수 없다 — 쓰기 전용이다.
 */
class Repository(private val context: Context) {
    private val auth = Firebase.auth
    private val db = Firebase.firestore

    private val keyPending = stringPreferencesKey("pending")
    private val keyBean = stringPreferencesKey("last_bean")
    private fun keyDraft(mode: Mode) = stringPreferencesKey("draft_${mode.key}")

    suspend fun uid(): String =
        auth.currentUser?.uid ?: auth.signInAnonymously().await().user!!.uid

    // ── 연결 ────────────────────────────────────────────────────────────

    /** watchLinks/{uid}를 지켜본다. 웹에서 해제하면 null이 흘러온다. */
    fun link(): Flow<Link?> = callbackFlow {
        val uid = uid()
        val reg = db.document("watchLinks/$uid").addSnapshotListener { snap, err ->
            if (err != null) {
                Log.w(TAG, "link listen failed", err)
                return@addSnapshotListener
            }
            val owner = snap?.getString("ownerUid")
            if (owner == null) {
                trySend(null)
                return@addSnapshotListener
            }
            val code = snap.getString("code").orEmpty()
            // 이름은 연결할 때 웹이 pair 문서에 남긴다. 못 읽어도 연결 자체는 유효하다.
            db.document("watchPairs/$code").get()
                .addOnSuccessListener { p -> trySend(Link(owner, p.getString("ownerName").orEmpty())) }
                .addOnFailureListener { trySend(Link(owner, "")) }
        }
        awaitClose { reg.remove() }
    }

    /**
     * 새 6자리 코드를 만든다. 아직 유효한 남의 코드와 겹치면 규칙이 거부하므로
     * 다른 숫자로 다시 시도한다(만료된 코드 문서는 덮어쓸 수 있다).
     */
    suspend fun newPairCode(): String {
        val uid = uid()
        repeat(8) {
            val code = String.format(Locale.US, "%06d", Random.nextInt(0, 1_000_000))
            try {
                withTimeout(15_000) {
                    db.document("watchPairs/$code")
                        .set(mapOf("watchUid" to uid, "createdAt" to FieldValue.serverTimestamp()))
                        .await()
                }
                return code
            } catch (e: FirebaseFirestoreException) {
                if (e.code != FirebaseFirestoreException.Code.PERMISSION_DENIED) throw e
            }
        }
        error("no free pairing code")
    }

    suspend fun unlink() {
        db.document("watchLinks/${uid()}").delete().await()
    }

    // ── 저장 ────────────────────────────────────────────────────────────

    /**
     * 연결돼 있으면 바로 Firestore에 쓴다. 쓰기는 기다리지 않는다 — 오프라인이면
     * Firestore 로컬 캐시에 쌓였다가 연결되면 올라간다.
     * 연결 전이면 워치에 보관했다가 연결되는 순간 flushPending()으로 올린다.
     */
    suspend fun save(recipe: Recipe, link: Link?) {
        rememberDraft(recipe.draft)
        if (link == null) {
            enqueue(recipe)
        } else {
            write(recipe, link.ownerUid)
        }
    }

    suspend fun flushPending(link: Link) {
        val pending = readPending()
        if (pending.isEmpty()) return
        pending.forEach { write(it, link.ownerUid) }
        context.dataStore.edit { it.remove(keyPending) }
    }

    fun pendingCount(): Flow<Int> = context.dataStore.data.map { prefs ->
        prefs[keyPending]?.let { JSONArray(it).length() } ?: 0
    }

    private fun write(recipe: Recipe, ownerUid: String) {
        db.collection("recipes").add(recipe.toFirestore(ownerUid))
            .addOnFailureListener { Log.w(TAG, "recipe write failed", it) }
        bumpAggregates(recipe.draft, ownerUid)
    }

    /**
     * storage.js bumpAggregates의 워치판 — 관리자 대시보드 일별·원두 집계.
     * users/{uid} 문서(recipeCount 등)는 본인만 쓸 수 있어 워치는 건드리지 않는다.
     * 집계 실패는 기록 저장에 영향을 주지 않는다.
     */
    private fun bumpAggregates(d: Draft, ownerUid: String) {
        val now = LocalDateTime.now()
        val one = FieldValue.increment(1)
        val daily = mutableMapOf<String, Any>(
            "count" to one,
            d.mode.key to one,
            "h${now.hour}" to one,
            "uc" to mapOf(ownerUid to one),
            "ratedCount" to one,
            "rating3" to one,
        )
        if (d.success) {
            daily["successCount"] = one
            daily[if (d.mode == Mode.ESPRESSO) "es" else "ds"] = one
        }
        val bean = d.beanName.trim()
        if (bean.isNotEmpty()) {
            val bid = beanDocId(bean)
            daily["bn"] = mapOf(bid to one)
            if (d.success) daily["bs"] = mapOf(bid to one)
            db.document("stats_beans/$bid").set(mapOf("name" to bean), SetOptions.merge())
                .addOnFailureListener { Log.w(TAG, "bean stat failed", it) }
        }
        db.document("stats_daily/${dayKey(now)}").set(daily, SetOptions.merge())
            .addOnFailureListener { Log.w(TAG, "daily stat failed", it) }
    }

    // ── 로컬(DataStore) ─────────────────────────────────────────────────

    /** 모드별 마지막 값 — 다음 추출을 같은 숫자에서 시작한다(웹의 modeValues와 같은 역할). */
    suspend fun lastDraft(mode: Mode): Draft {
        val prefs = context.dataStore.data.first()
        val base = prefs[keyDraft(mode)]?.let { runCatching { draftFrom(JSONObject(it)) }.getOrNull() }
            ?: Draft.defaults(mode)
        return base.copy(beanName = prefs[keyBean].orEmpty(), success = true)
    }

    private suspend fun rememberDraft(d: Draft) {
        context.dataStore.edit {
            it[keyDraft(d.mode)] = draftJson(d).toString()
            it[keyBean] = d.beanName
        }
    }

    private suspend fun enqueue(r: Recipe) {
        context.dataStore.edit { prefs ->
            val arr = prefs[keyPending]?.let { JSONArray(it) } ?: JSONArray()
            arr.put(draftJson(r.draft).put("date", r.date))
            prefs[keyPending] = arr.toString()
        }
    }

    private suspend fun readPending(): List<Recipe> {
        val raw = context.dataStore.data.first()[keyPending] ?: return emptyList()
        val arr = JSONArray(raw)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Recipe(draftFrom(o), o.getString("date"))
        }
    }

    private fun draftJson(d: Draft) = JSONObject()
        .put("mode", d.mode.key)
        .put("dosing", d.dosing)
        .put("temp", d.temp)
        .put("time", d.time)
        .put("yield", d.yield)
        .put("beanName", d.beanName)
        .put("success", d.success)

    private fun draftFrom(o: JSONObject) = Draft(
        mode = Mode.of(o.optString("mode")),
        dosing = o.getDouble("dosing"),
        temp = o.getDouble("temp"),
        time = o.getDouble("time"),
        yield = o.getDouble("yield"),
        beanName = o.optString("beanName"),
        success = o.optBoolean("success", true),
    )

    companion object {
        private const val TAG = "NoteMyCoffee"
    }
}
