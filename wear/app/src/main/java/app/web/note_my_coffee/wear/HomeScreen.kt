package app.web.note_my_coffee.wear

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition

@Composable
fun HomeScreen(vm: BrewViewModel, onBrew: (Mode) -> Unit, onPair: () -> Unit) {
    val link by vm.link.collectAsStateWithLifecycle()
    val pending by vm.pending.collectAsStateWithLifecycle()
    HomeContent(link, pending, onBrew, onPair)
}

/** 상태 없는 홈 화면 — 스크린샷 테스트도 이걸 그린다. */
@Composable
fun HomeContent(link: Link?, pending: Int, onBrew: (Mode) -> Unit, onPair: () -> Unit) {
    val state = rememberScalingLazyListState()

    ListScaffold(state) {
        ScalingLazyColumn(modifier = Modifier.fillMaxWidth(), state = state) {
            item {
                ListHeader { Text(stringResource(R.string.app_name), color = Muted) }
            }
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { onBrew(Mode.ESPRESSO) },
                    label = { Text(stringResource(R.string.espresso)) },
                    secondaryLabel = { Text(stringResource(R.string.target, targetRange(Mode.ESPRESSO)), style = Readout.copy(color = Muted)) },
                    colors = ChipDefaults.primaryChipColors(),
                )
            }
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { onBrew(Mode.DRIP) },
                    label = { Text(stringResource(R.string.drip)) },
                    secondaryLabel = { Text(stringResource(R.string.target, targetRange(Mode.DRIP)), style = Readout.copy(color = Muted)) },
                    colors = ChipDefaults.secondaryChipColors(),
                )
            }
            item {
                val l = link
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onPair,
                    label = {
                        Text(
                            if (l != null) stringResource(R.string.connected) else stringResource(R.string.connect),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    secondaryLabel = {
                        val sub = when {
                            pending > 0 -> stringResource(R.string.pending, pending)
                            l != null && l.ownerName.isNotBlank() -> l.ownerName
                            l == null -> stringResource(R.string.not_connected)
                            else -> null
                        }
                        if (sub != null) Text(sub, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    },
                    colors = ChipDefaults.childChipColors(),
                )
            }
        }
    }
}

/** 목록 화면 공통 틀: 시계, 가장자리 비네트, 스크롤 위치 표시. */
@Composable
fun ListScaffold(state: ScalingLazyListState, content: @Composable () -> Unit) {
    Scaffold(
        timeText = { TimeText() },
        vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) },
        positionIndicator = { PositionIndicator(scalingLazyListState = state) },
    ) {
        content()
    }
}

@Composable
fun MutedText(text: String) {
    Text(text, color = MaterialTheme.colors.onSurfaceVariant, style = MaterialTheme.typography.caption2)
}
