package expo.modules.xmtpreactnativesdk.example

import android.util.Log
import androidx.test.core.app.takeScreenshot
import androidx.test.core.graphics.writeToTestStorage
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.ViewAction
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.matcher.ViewMatchers.withContentDescription
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.xmtpreactnativesdk.example.EspressoViewFinder.waitForDisplayed
import junit.framework.TestCase
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestName
import org.junit.runner.RunWith

@LargeTest
@RunWith(AndroidJUnit4::class)
class IntegrationUITest {
//    @get:Rule
//    var nameRule = TestName()

//    @get:Rule
//    var activityScenarioRule: ActivityScenarioRule<MainActivity> =
//        ActivityScenarioRule(MainActivity::class.java)

    @Before
    fun testing() {
        println("HELP1")
    }

    @Test
    fun testRunTests() {
        println("HELP")
//        activityScenarioRule.scenario
        waitForDisplayed(withContentDescription("Unit tests")) { button ->
            // Go to unit tests page
            onView(button).perform(click())
            waitForDisplayed(withContentDescription("Test View")) { view ->
                onView(view).perform(waitForText("tests-complete", 5000))
                val failures = onView(view).perform(waitForText("FAIL", 3000))
                if (failures.equals(true)) {
                    // Take a screenshot so we can see what failed in the UI
//                    takeScreenshot().writeToTestStorage("${javaClass.simpleName}_${nameRule.methodName}")
                    TestCase.fail("Test failed")
                }

            }
        }
    }

    private fun waitForText(text: String, timeout: Long): ViewAction {
        return WaitForTextAction(text, timeout)
    }
}
