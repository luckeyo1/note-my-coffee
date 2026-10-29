package app.web.note_my_coffee.wear

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * 워치 화면 스크린샷 — JVM(Robolectric)에서 실제 Compose 화면을 그린다.
 *
 * 기록: ./gradlew :app:recordRoborazziDebug → store/wear/*.png
 * (일반 testDebugUnitTest에서는 그리기만 하고 파일은 쓰지 않는다)
 * Play Console의 Wear OS 스크린샷(정사각형, 마스크 없음)으로 그대로 쓸 수 있다.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = WEAR_LARGE_ROUND)
class ScreenshotTest {

    private fun shot(name: String, content: @Composable () -> Unit) =
        captureRoboImage("$OUT/$name.png") {
            NmcTheme {
                // 기기에서는 창 배경이 검정이다(themes.xml) — 캡처에도 같은 바탕을 깐다.
                Box(Modifier.fillMaxSize().background(Color.Black)) { content() }
            }
        }

    private val espresso = Draft.defaults(Mode.ESPRESSO).copy(time = 27.3, beanName = "에티오피아 예가체프")

    @Test @Config(qualifiers = "+ko")
    fun ko_1_home() = shot("ko-1-home") { HomeContent(link = null, pending = 2, onBrew = {}, onPair = {}) }

    @Test @Config(qualifiers = "+ko")
    fun ko_2_timer_espresso() = shot("ko-2-timer-espresso") {
        TimerContent(TimerState(running = true, elapsedMs = 27_300), Mode.ESPRESSO, {}, {}, {})
    }

    @Test @Config(qualifiers = "+ko")
    fun ko_3_timer_drip_bloom() = shot("ko-3-timer-drip") {
        TimerContent(TimerState(running = true, elapsedMs = 12_400), Mode.DRIP, {}, {}, {})
    }

    @Test @Config(qualifiers = "+ko")
    fun ko_4_timer_stopped() = shot("ko-4-timer-stopped") {
        TimerContent(TimerState(running = false, elapsedMs = 28_600), Mode.ESPRESSO, {}, {}, {})
    }

    @Test @Config(qualifiers = "+ko")
    fun ko_5_log() = shot("ko-5-log") { LogContent(espresso, {}, {}, {}, {}) }

    @Test @Config(qualifiers = "+ko")
    fun ko_6_edit_dose() = shot("ko-6-edit-dose") { EditContent(espresso, Field.DOSING, {}, {}) }

    @Test @Config(qualifiers = "+ko")
    fun ko_7_pair_code() = shot("ko-7-pair-code") {
        PairContent(link = null, pair = PairState.Code("123456"), onNewCode = {}, onUnlink = {})
    }

    @Test @Config(qualifiers = "+ko")
    fun ko_8_pair_connected() = shot("ko-8-pair-connected") {
        PairContent(link = Link("owner1", "모닝브루"), pair = PairState.Idle, onNewCode = {}, onUnlink = {})
    }

    @Test @Config(qualifiers = "+ko")
    fun ko_9_saved() = shot("ko-9-saved") { SavedScreen(synced = true, onDone = {}) }

    @Test
    fun en_1_home() = shot("en-1-home") { HomeContent(link = Link("owner1", "Morning Brew"), pending = 0, onBrew = {}, onPair = {}) }

    @Test
    fun en_2_timer_espresso() = shot("en-2-timer-espresso") {
        TimerContent(TimerState(running = true, elapsedMs = 27_300), Mode.ESPRESSO, {}, {}, {})
    }
}

/** Wear OS Large Round(454×454px, xhdpi) — Android Studio 에뮬레이터 기본 워치와 같은 크기 */
const val WEAR_LARGE_ROUND = "w227dp-h227dp-small-notlong-round-watch-xhdpi-keyshidden-nonav"

/** 모듈(wear/app) 기준 — 저장소의 store/wear/ */
private const val OUT = "../../store/wear"
