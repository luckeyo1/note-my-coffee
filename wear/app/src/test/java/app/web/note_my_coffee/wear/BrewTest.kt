package app.web.note_my_coffee.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class BrewTest {

    // 기대값은 웹 storage.js의 beanDocId로 뽑았다 — 같은 원두가 같은 집계 문서로 모여야 한다.
    @Test
    fun beanDocId_matchesWeb() {
        assertEquals("bztntfp", beanDocId(""))
        assertEquals("b2x5mz", beanDocId("Ethiopia Yirgacheffe"))
        assertEquals("bbdewtn", beanDocId("예가체프 G1"))
        assertEquals("bdtq2t7", beanDocId("コロンビア"))
        assertEquals("b155ydkp", beanDocId("☕ 🫘 Blend"))
    }

    @Test
    fun clamp_roundsToStepAndRange() {
        val dose = Field.DOSING.spec(Mode.ESPRESSO)
        assertEquals(18.1, dose.clamp(18.0 + 0.1), 0.0) // 부동소수 오차 제거
        assertEquals(40.0, dose.clamp(55.0), 0.0)
        assertEquals(7.0, dose.clamp(1.0), 0.0)
        val water = Field.YIELD.spec(Mode.DRIP)
        assertEquals(321.0, water.clamp(320.6), 0.0)
    }

    @Test
    fun draft_nudgeStaysInRange() {
        val d = Draft.defaults(Mode.ESPRESSO).with(Field.TIME, 59.95).with(Field.TIME, 70.0)
        assertEquals(60.0, d.time, 0.0)
    }

    @Test
    fun formatValue_followsWebNotation() {
        assertEquals("28.5", formatValue(Field.TIME, Mode.ESPRESSO, 28.5))
        assertEquals("3:00", formatValue(Field.TIME, Mode.DRIP, 180.0))
        assertEquals("45", formatValue(Field.TIME, Mode.DRIP, 45.0))
        assertEquals("320", formatValue(Field.YIELD, Mode.DRIP, 320.0))
        assertEquals("18.0", formatValue(Field.DOSING, Mode.DRIP, 18.0))
    }

    @Test
    fun formatClock_matchesWebStopwatch() {
        assertEquals("01:05.3", formatClock(65_300))
        assertEquals("09.8", formatClock(9_800))
        assertEquals("00.0", formatClock(0))
    }

    @Test
    fun dayKey_isLocalDate() {
        assertEquals("2026-01-05", dayKey(LocalDateTime.of(2026, 1, 5, 23, 59)))
    }

    @Test
    fun recipe_hasWebFieldsAndWatchSource() {
        val doc = Recipe(Draft.defaults(Mode.DRIP).copy(beanName = "케냐"), "2026-10-29T00:00:00Z")
            .toFirestore("owner1")
        assertEquals("watch", doc["source"])
        assertEquals("owner1", doc["userId"])
        assertEquals("drip", doc["mode"])
        assertEquals("케냐", doc["beanName"])
        // main.js 레시피 객체의 필드가 모두 있어야 로그북이 그대로 그린다
        val webFields = listOf(
            "date", "mode", "dosing", "temp", "time", "yield", "beanName", "origin", "purchaseUrl",
            "imageUrl", "tasteNotes", "overallRating", "success", "weather", "beanStatus",
        )
        webFields.forEach { assertTrue("missing $it", it in doc) }
    }
}
