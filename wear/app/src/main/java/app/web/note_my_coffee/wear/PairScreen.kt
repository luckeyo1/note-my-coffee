package app.web.note_my_coffee.wear

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Text

/**
 * 웹 로그북과 연결. 연결 전이면 6자리 코드를 띄우고, 웹에서 입력되면
 * link 흐름(watchLinks 리스너)이 바뀌어 자동으로 "연결됨" 화면이 된다.
 */
@Composable
fun PairScreen(vm: BrewViewModel) {
    val link by vm.link.collectAsStateWithLifecycle()
    val pair by vm.pair.collectAsStateWithLifecycle()
    val state = rememberScalingLazyListState()

    // 연결 안 된 상태로 들어오면 바로 코드를 받는다.
    LaunchedEffect(link == null) {
        if (link == null && pair !is PairState.Code) vm.requestCode()
    }

    ListScaffold(state) {
        ScalingLazyColumn(modifier = Modifier.fillMaxWidth(), state = state) {
            val l = link
            if (l != null) {
                item { ListHeader { Text(stringResource(R.string.connected), color = Clay) } }
                if (l.ownerName.isNotBlank()) {
                    item { Text(l.ownerName, color = Cream, textAlign = TextAlign.Center) }
                }
                item {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = vm::unlink,
                        label = { Text(stringResource(R.string.disconnect)) },
                        colors = ChipDefaults.secondaryChipColors(),
                    )
                }
            } else {
                item { ListHeader { Text(stringResource(R.string.connect), color = Muted) } }
                when (val p = pair) {
                    is PairState.Code -> {
                        item {
                            // 읽기 쉽게 3자리씩 띄운다(입력은 붙여서 해도 된다).
                            Text(
                                p.code.chunked(3).joinToString(" "),
                                style = Readout.copy(fontSize = 34.sp, color = Clay),
                            )
                        }
                        item { MutedText(stringResource(R.string.pair_expires)) }
                        item {
                            Text(
                                stringResource(R.string.pair_howto),
                                color = Cream,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center,
                            )
                        }
                        item {
                            Chip(
                                modifier = Modifier.fillMaxWidth(),
                                onClick = vm::requestCode,
                                label = { Text(stringResource(R.string.pair_new)) },
                                colors = ChipDefaults.secondaryChipColors(),
                            )
                        }
                    }
                    PairState.Error -> {
                        item {
                            Text(stringResource(R.string.pair_error), color = Cream, textAlign = TextAlign.Center)
                        }
                        item {
                            Chip(
                                modifier = Modifier.fillMaxWidth(),
                                onClick = vm::requestCode,
                                label = { Text(stringResource(R.string.retry)) },
                                colors = ChipDefaults.primaryChipColors(),
                            )
                        }
                    }
                    PairState.Idle, PairState.Loading -> {
                        item { MutedText(stringResource(R.string.loading)) }
                    }
                }
            }
        }
    }
}
