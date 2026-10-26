package app.web.note_my_coffee.wear

import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** 웹 앱(main.js)의 currentMode 값과 같다. */
enum class Mode(val key: String) {
    ESPRESSO("espresso"),
    DRIP("drip");

    companion object {
        fun of(key: String?) = entries.firstOrNull { it.key == key } ?: ESPRESSO
    }
}

/** 숫자 네 개. 범위·기본값·권장 구간은 웹 앱(app.html 슬라이더, main.js qualityRanges)과 맞춘다. */
enum class Field(val key: String) {
    DOSING("dosing"),
    TEMP("temp"),
    TIME("time"),
    YIELD("yield");

    fun spec(mode: Mode): FieldSpec = when (this) {
        DOSING -> FieldSpec(7.0, 40.0, 0.1, "g")
        TEMP -> FieldSpec(80.0, 100.0, 0.1, "°C")
        TIME -> if (mode == Mode.ESPRESSO) FieldSpec(0.0, 60.0, 0.1, "s") else FieldSpec(0.0, 600.0, 1.0, "s")
        YIELD -> if (mode == Mode.ESPRESSO) FieldSpec(10.0, 60.0, 0.1, "g") else FieldSpec(50.0, 700.0, 1.0, "g")
    }

    companion object {
        fun of(key: String?) = entries.firstOrNull { it.key == key } ?: DOSING
    }
}

data class FieldSpec(val min: Double, val max: Double, val step: Double, val unit: String) {
    fun clamp(v: Double): Double {
        // 0.1 단위 부동소수 오차(18.000000000000004)가 Firestore에 그대로 들어가지 않게 반올림
        val stepped = Math.round(v / step) * step
        return (Math.round(stepped.coerceIn(min, max) * 10.0) / 10.0)
    }
}

/** 권장 구간(main.js qualityRanges.time의 idealLow/idealHigh) — 타이머 진동 기준 */
fun idealTime(mode: Mode): ClosedFloatingPointRange<Double> =
    if (mode == Mode.ESPRESSO) 25.0..35.0 else 120.0..240.0

/** 핸드드립 뜸 들이기 끝 — 이때 한 번 진동한다. */
const val BLOOM_SECONDS = 30.0

data class Draft(
    val mode: Mode = Mode.ESPRESSO,
    val dosing: Double = 18.0,
    val temp: Double = 92.0,
    val time: Double = 28.5,
    val yield: Double = 36.0,
    val beanName: String = "",
    val success: Boolean = true,
) {
    fun get(f: Field) = when (f) {
        Field.DOSING -> dosing
        Field.TEMP -> temp
        Field.TIME -> time
        Field.YIELD -> yield
    }

    fun with(f: Field, v: Double): Draft {
        val c = f.spec(mode).clamp(v)
        return when (f) {
            Field.DOSING -> copy(dosing = c)
            Field.TEMP -> copy(temp = c)
            Field.TIME -> copy(time = c)
            Field.YIELD -> copy(yield = c)
        }
    }

    companion object {
        /** main.js modeValues와 같은 시작값 */
        fun defaults(mode: Mode) = when (mode) {
            Mode.ESPRESSO -> Draft(Mode.ESPRESSO, 18.0, 92.0, 28.5, 36.0)
            Mode.DRIP -> Draft(Mode.DRIP, 20.0, 93.0, 180.0, 320.0)
        }
    }
}

/**
 * 웹 main.js가 저장하는 레시피 문서와 같은 모양으로 만든다 — 로그북은 수정 없이 보여준다.
 * source='watch'는 firestore.rules가 워치 쓰기를 허용하는 조건이다.
 */
data class Recipe(val draft: Draft, val date: String = Instant.now().toString()) {
    fun toFirestore(ownerUid: String): Map<String, Any> = mapOf(
        "date" to date,
        "mode" to draft.mode.key,
        "dosing" to draft.dosing,
        "temp" to draft.temp,
        "time" to draft.time,
        "yield" to draft.yield,
        "beanName" to draft.beanName,
        "origin" to "",
        "purchaseUrl" to "",
        "imageUrl" to "",
        "tasteNotes" to "",
        "overallRating" to 3,
        "success" to draft.success,
        "weather" to "",
        "beanStatus" to "",
        "userId" to ownerUid,
        "source" to "watch",
    )
}

/** storage.js dayKeyOf와 같은 로컬 날짜 키(yyyy-MM-dd) */
fun dayKey(now: LocalDateTime = LocalDateTime.now()): String =
    now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US))

/** storage.js beanDocId와 같은 FNV-1a — 같은 원두가 웹/워치에서 같은 집계 문서로 모인다. */
fun beanDocId(name: String): String {
    var h = 0x811c9dc5.toInt()
    for (c in name) {
        h = h xor c.code
        h *= 0x01000193
    }
    return "b" + h.toUInt().toString(36)
}

/** 28.5 → "28.5", 180 → "3:00"(드립 60초 이상은 m:ss — main.js fmtBrewClock) */
fun formatValue(f: Field, mode: Mode, v: Double): String =
    if (f == Field.TIME && mode == Mode.DRIP && v >= 60) {
        val t = Math.round(v).toInt()
        String.format(Locale.US, "%d:%02d", t / 60, t % 60)
    } else if (f.spec(mode).step >= 1.0) {
        String.format(Locale.US, "%.0f", v)
    } else {
        String.format(Locale.US, "%.1f", v)
    }
