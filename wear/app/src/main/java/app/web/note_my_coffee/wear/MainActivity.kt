package app.web.note_my_coffee.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContent { NoteMyCoffeeApp() }
    }
}

// 디자인: 웹의 "계측기 노트"를 워치(OLED)로 옮긴다 — 검정 바탕, 크림 잉크,
// 신호색은 클레이 하나. 수치는 전부 모노스페이스 + 탭형 숫자.
val Clay = Color(0xFFD8794E)     // --clay-on-dark
val Cream = Color(0xFFFCFAF6)    // --cream
val Muted = Color(0xFFA89C8E)
val Panel = Color(0xFF1E1914)

val Readout = TextStyle(
    fontFamily = FontFamily.Monospace,
    fontWeight = FontWeight.Medium,
    fontFeatureSettings = "tnum",
    color = Cream,
)

private val NmcColors = Colors(
    primary = Clay,
    primaryVariant = Clay,
    secondary = Cream,
    secondaryVariant = Muted,
    background = Color.Black,
    surface = Panel,
    error = Color(0xFFE5735F),
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onBackground = Cream,
    onSurface = Cream,
    onSurfaceVariant = Muted,
    onError = Color.Black,
)

object Routes {
    const val HOME = "home"
    const val TIMER = "timer"
    const val LOG = "log"
    const val EDIT = "edit/{field}"
    const val SAVED = "saved/{synced}"
    const val PAIR = "pair"
    fun edit(f: Field) = "edit/${f.key}"
    fun saved(synced: Boolean) = "saved/$synced"
}

@Composable
fun NmcTheme(content: @Composable () -> Unit) {
    MaterialTheme(colors = NmcColors, content = content)
}

@Composable
fun NoteMyCoffeeApp(vm: BrewViewModel = viewModel()) {
    NmcTheme {
        val nav = rememberSwipeDismissableNavController()
        SwipeDismissableNavHost(navController = nav, startDestination = Routes.HOME) {
            composable(Routes.HOME) {
                HomeScreen(
                    vm = vm,
                    onBrew = { mode ->
                        vm.startBrew(mode)
                        nav.navigate(Routes.TIMER)
                    },
                    onPair = { nav.navigate(Routes.PAIR) },
                )
            }
            composable(Routes.TIMER) {
                TimerScreen(
                    vm = vm,
                    onLog = {
                        vm.takeTimerTime()
                        nav.navigate(Routes.LOG)
                    },
                )
            }
            composable(Routes.LOG) {
                LogScreen(
                    vm = vm,
                    onEdit = { f -> nav.navigate(Routes.edit(f)) },
                    onSaved = { synced ->
                        nav.navigate(Routes.saved(synced)) {
                            popUpTo(Routes.HOME)
                        }
                    },
                )
            }
            composable(Routes.EDIT) { entry ->
                EditScreen(
                    vm = vm,
                    field = Field.of(entry.arguments?.getString("field")),
                    onDone = { nav.popBackStack() },
                )
            }
            composable(Routes.SAVED) { entry ->
                SavedScreen(
                    synced = entry.arguments?.getString("synced") == "true",
                    onDone = { nav.popBackStack(Routes.HOME, inclusive = false) },
                )
            }
            composable(Routes.PAIR) {
                PairScreen(vm = vm)
            }
        }
    }
}
