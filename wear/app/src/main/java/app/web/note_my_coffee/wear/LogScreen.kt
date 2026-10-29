package app.web.note_my_coffee.wear

import android.app.Activity
import android.app.RemoteInput
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Switch
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.ToggleChip
import androidx.wear.input.RemoteInputIntentHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val BEAN_KEY = "bean"

@Composable
private fun fieldLabel(f: Field, mode: Mode): String = stringResource(
    when (f) {
        Field.DOSING -> R.string.dosing
        Field.TEMP -> R.string.temp
        Field.TIME -> R.string.time
        Field.YIELD -> if (mode == Mode.ESPRESSO) R.string.yield_espresso else R.string.yield_drip
    },
)

/** 숫자 네 개 + 원두 + 성공 여부를 확인하고 저장한다. 각 숫자는 탭해서 크라운/베젤로 조정. */
@Composable
fun LogScreen(vm: BrewViewModel, onEdit: (Field) -> Unit, onSaved: (Boolean) -> Unit) {
    val draft by vm.draft.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    // 원두 이름은 워치 키보드/음성 입력(RemoteInput)으로 받는다.
    val beanLabel = stringResource(R.string.bean)
    val beanInput = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        if (res.resultCode != Activity.RESULT_OK) return@rememberLauncherForActivityResult
        val text = res.data?.let { RemoteInput.getResultsFromIntent(it) }?.getCharSequence(BEAN_KEY)
        if (text != null) vm.setBean(text.toString())
    }

    LogContent(
        draft = draft,
        onEdit = onEdit,
        onBean = {
            val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
            RemoteInputIntentHelper.putRemoteInputsExtra(
                intent,
                listOf(RemoteInput.Builder(BEAN_KEY).setLabel(beanLabel).build()),
            )
            beanInput.launch(intent)
        },
        onSuccess = vm::setSuccess,
        onSave = { scope.launch { onSaved(vm.save()) } },
    )
}

@Composable
fun LogContent(
    draft: Draft,
    onEdit: (Field) -> Unit,
    onBean: () -> Unit,
    onSuccess: (Boolean) -> Unit,
    onSave: () -> Unit,
) {
    val state = rememberScalingLazyListState()
    val beanLabel = stringResource(R.string.bean)

    ListScaffold(state) {
        ScalingLazyColumn(modifier = Modifier.fillMaxWidth(), state = state) {
            item { ListHeader { Text(stringResource(R.string.log_title), color = Muted) } }
            Field.entries.forEach { f ->
                item {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { onEdit(f) },
                        label = { Text(fieldLabel(f, draft.mode), color = Muted, fontSize = 12.sp) },
                        secondaryLabel = {
                            Text(
                                formatValue(f, draft.mode, draft.get(f)) + " " + f.spec(draft.mode).unit,
                                style = Readout.copy(fontSize = 18.sp),
                            )
                        },
                        colors = ChipDefaults.secondaryChipColors(),
                    )
                }
            }
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onBean,
                    label = { Text(beanLabel, color = Muted, fontSize = 12.sp) },
                    secondaryLabel = {
                        Text(draft.beanName.ifBlank { stringResource(R.string.bean_empty) }, maxLines = 1)
                    },
                    colors = ChipDefaults.secondaryChipColors(),
                )
            }
            item {
                ToggleChip(
                    modifier = Modifier.fillMaxWidth(),
                    checked = draft.success,
                    onCheckedChange = onSuccess,
                    label = { Text(stringResource(R.string.success)) },
                    toggleControl = { Switch(checked = draft.success) },
                )
            }
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onSave,
                    label = { Text(stringResource(R.string.save)) },
                    colors = ChipDefaults.primaryChipColors(),
                )
            }
        }
    }
}

/**
 * 숫자 하나를 크라운/베젤로 조정한다. 한 칸(디텐트)마다 0.1(드립 시간·물량은 1).
 * −/+ 버튼은 베젤이 없는 모델용.
 */
@Composable
fun EditScreen(vm: BrewViewModel, field: Field, onDone: () -> Unit) {
    val draft by vm.draft.collectAsStateWithLifecycle()
    EditContent(draft, field, onNudge = { steps -> vm.nudge(field, steps) }, onDone = onDone)
}

@Composable
fun EditContent(draft: Draft, field: Field, onNudge: (Int) -> Unit, onDone: () -> Unit) {
    val focus = remember { FocusRequester() }
    val acc = remember { FloatArray(1) }
    LaunchedEffect(Unit) { focus.requestFocus() }

    Scaffold(timeText = { TimeText() }) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .onRotaryScrollEvent { e ->
                    // 회전 베젤은 한 칸에 큰 값, 크라운은 잘게 들어온다 — 누적해서 칸으로 바꾼다.
                    acc[0] += e.verticalScrollPixels
                    val steps = (acc[0] / ROTARY_PX_PER_STEP).toInt()
                    if (steps != 0) {
                        acc[0] -= steps * ROTARY_PX_PER_STEP
                        onNudge(steps)
                    }
                    true
                }
                .focusRequester(focus)
                .focusable(),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(fieldLabel(field, draft.mode), color = Muted, fontSize = 13.sp)
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(formatValue(field, draft.mode, draft.get(field)), style = Readout.copy(fontSize = 38.sp))
                    Spacer(Modifier.width(4.dp))
                    Text(field.spec(draft.mode).unit, style = Readout.copy(fontSize = 14.sp, color = Muted))
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = { onNudge(-1) }, colors = ButtonDefaults.secondaryButtonColors()) {
                        Text("−", fontSize = 20.sp)
                    }
                    Button(onClick = { onNudge(1) }, colors = ButtonDefaults.secondaryButtonColors()) {
                        Text("+", fontSize = 20.sp)
                    }
                }
                Spacer(Modifier.height(6.dp))
                CompactChip(
                    onClick = onDone,
                    label = { Text(stringResource(R.string.done)) },
                    colors = ChipDefaults.primaryChipColors(),
                )
            }
        }
    }
}

private const val ROTARY_PX_PER_STEP = 24f

/** 저장 확인 — 잠깐 보여주고 홈으로 돌아간다. */
@Composable
fun SavedScreen(synced: Boolean, onDone: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(1_800)
        onDone()
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("✓", style = Readout.copy(fontSize = 34.sp, color = Clay))
            Text(
                stringResource(if (synced) R.string.saved_synced else R.string.saved_local),
                color = Cream,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(0.8f),
            )
        }
    }
}
