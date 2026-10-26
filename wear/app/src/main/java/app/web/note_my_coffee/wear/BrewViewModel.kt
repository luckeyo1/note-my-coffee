package app.web.note_my_coffee.wear

import android.app.Application
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.retryWhen
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class TimerState(val running: Boolean = false, val elapsedMs: Long = 0L) {
    val seconds get() = elapsedMs / 1000.0
}

sealed interface PairState {
    data object Idle : PairState
    data object Loading : PairState
    data class Code(val code: String) : PairState
    data object Error : PairState
}

class BrewViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = Repository(app)
    private val vibrator = app.getSystemService(Vibrator::class.java)

    /** 연결 상태. 연결되는 순간 워치에 보관해둔 기록을 올린다. */
    val link: StateFlow<Link?> = repo.link()
        .retryWhen { e, _ ->
            Log.w("NoteMyCoffee", "link flow failed, retrying", e)
            delay(5_000)
            true
        }
        .onEach { l -> if (l != null) repo.flushPending(l) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val pending: StateFlow<Int> = repo.pendingCount()
        .stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    private val _draft = MutableStateFlow(Draft())
    val draft: StateFlow<Draft> = _draft.asStateFlow()

    private val _timer = MutableStateFlow(TimerState())
    val timer: StateFlow<TimerState> = _timer.asStateFlow()

    private val _pair = MutableStateFlow<PairState>(PairState.Idle)
    val pair: StateFlow<PairState> = _pair.asStateFlow()

    private var tickJob: Job? = null

    // ── 추출 흐름 ──────────────────────────────────────────────────────

    fun startBrew(mode: Mode) {
        resetTimer()
        viewModelScope.launch { _draft.value = repo.lastDraft(mode) }
    }

    fun toggleTimer() {
        if (_timer.value.running) stopTimer() else startTimer()
    }

    private fun startTimer() {
        val mode = _draft.value.mode
        val base = _timer.value.elapsedMs
        val startedAt = SystemClock.elapsedRealtime() - base
        _timer.value = TimerState(running = true, elapsedMs = base)
        buzz(short = true)
        tickJob = viewModelScope.launch {
            var last = base / 1000.0
            while (isActive) {
                val ms = SystemClock.elapsedRealtime() - startedAt
                _timer.update { it.copy(elapsedMs = ms) }
                val now = ms / 1000.0
                // 구간 진입 순간 손목으로 알린다 — 화면을 안 봐도 되게.
                milestones(mode).forEach { m -> if (last < m && now >= m) buzz(short = false) }
                last = now
                delay(50)
            }
        }
    }

    private fun stopTimer() {
        tickJob?.cancel()
        _timer.update { it.copy(running = false) }
        buzz(short = true)
    }

    fun resetTimer() {
        tickJob?.cancel()
        _timer.value = TimerState()
    }

    /** 타이머를 멈추고 잰 시간을 기록 초안에 넣는다. 안 쟀으면(0초) 기존 값을 둔다. */
    fun takeTimerTime() {
        if (_timer.value.running) stopTimer()
        val secs = _timer.value.seconds
        if (secs > 0) _draft.update { it.with(Field.TIME, secs) }
    }

    fun nudge(field: Field, steps: Int) {
        _draft.update { it.with(field, it.get(field) + steps * field.spec(it.mode).step) }
    }

    fun setBean(name: String) = _draft.update { it.copy(beanName = name.trim().take(80)) }

    fun setSuccess(ok: Boolean) = _draft.update { it.copy(success = ok) }

    /** @return true면 계정 로그북에 바로 올라감, false면 워치에 보관(연결 후 동기화) */
    suspend fun save(): Boolean {
        val l = link.value
        repo.save(Recipe(_draft.value), l)
        return l != null
    }

    // ── 페어링 ─────────────────────────────────────────────────────────

    fun requestCode() {
        _pair.value = PairState.Loading
        viewModelScope.launch {
            _pair.value = try {
                PairState.Code(repo.newPairCode())
            } catch (e: Exception) {
                Log.w("NoteMyCoffee", "pair code failed", e)
                PairState.Error
            }
        }
    }

    fun unlink() {
        viewModelScope.launch {
            runCatching { repo.unlink() }.onFailure { Log.w("NoteMyCoffee", "unlink failed", it) }
            _pair.value = PairState.Idle
        }
    }

    private fun milestones(mode: Mode): List<Double> {
        val ideal = idealTime(mode)
        return if (mode == Mode.DRIP) listOf(BLOOM_SECONDS, ideal.start, ideal.endInclusive)
        else listOf(ideal.start, ideal.endInclusive)
    }

    private fun buzz(short: Boolean) {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        val effect = if (short) VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE)
        else VibrationEffect.createWaveform(longArrayOf(0, 120, 80, 120), -1)
        v.vibrate(effect)
    }
}
