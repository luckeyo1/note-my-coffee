package app.web.note_my_coffee.wear

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.material.CompactButton
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import java.util.Locale

/**
 * 추출 타이머. 화면 아무 데나 탭하면 시작/정지 — 젖은 손으로 작은 버튼을 노리지 않게.
 * 권장 구간에 들어서고 벗어나는 순간 진동한다(BrewViewModel.milestones).
 */
@Composable
fun TimerScreen(vm: BrewViewModel, onLog: () -> Unit) {
    val timer by vm.timer.collectAsStateWithLifecycle()
    val draft by vm.draft.collectAsStateWithLifecycle()
    val mode = draft.mode
    val secs = timer.seconds
    val ideal = idealTime(mode)

    // 추출 중에는 화면이 꺼지지 않게
    val view = LocalView.current
    DisposableEffect(timer.running) {
        view.keepScreenOn = timer.running
        onDispose { view.keepScreenOn = false }
    }

    val readoutColor = when {
        secs == 0.0 -> Cream
        secs in ideal -> Clay
        secs > ideal.endInclusive -> Color(0xFFE5735F)
        else -> Cream
    }
    val hint = when {
        mode == Mode.DRIP && timer.running && secs < BLOOM_SECONDS -> stringResource(R.string.bloom)
        timer.running -> stringResource(R.string.tap_stop)
        else -> stringResource(R.string.tap_start)
    }

    Scaffold(timeText = { TimeText() }) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable(onClick = vm::toggleTimer),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    stringResource(if (mode == Mode.ESPRESSO) R.string.espresso else R.string.drip),
                    color = Muted,
                    fontSize = 13.sp,
                )
                Text(
                    formatClock(timer.elapsedMs),
                    style = Readout.copy(fontSize = 40.sp, color = readoutColor),
                )
                Text(
                    stringResource(R.string.target, targetRange(mode)),
                    style = Readout.copy(fontSize = 12.sp, color = Muted),
                )
                Spacer(Modifier.height(4.dp))
                Text(hint, color = Muted, fontSize = 12.sp)
                if (!timer.running) {
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        if (timer.elapsedMs > 0) {
                            CompactButton(
                                onClick = vm::resetTimer,
                                colors = ButtonDefaults.secondaryButtonColors(),
                            ) { Text("↺") }
                            Spacer(Modifier.width(6.dp))
                        }
                        CompactChip(
                            onClick = onLog,
                            label = { Text(stringResource(R.string.log)) },
                            colors = ChipDefaults.primaryChipColors(),
                            modifier = Modifier.padding(0.dp),
                        )
                    }
                }
            }
        }
    }
}

/** 65_300ms → "01:05.3", 9_800ms → "09.8" (웹 스톱워치 swFormatTime과 같은 표기) */
fun formatClock(ms: Long): String {
    val min = ms / 60_000
    val sec = (ms / 1000) % 60
    val tenth = (ms % 1000) / 100
    return if (min > 0) String.format(Locale.US, "%02d:%02d.%d", min, sec, tenth)
    else String.format(Locale.US, "%02d.%d", sec, tenth)
}

/** 권장 추출 시간 표기 — idealTime(mode)과 같은 구간 */
fun targetRange(mode: Mode): String =
    if (mode == Mode.ESPRESSO) "25–35s" else "2:00–4:00"
