package expo.modules.xmtpreactnativesdk.example

import android.view.View
import android.widget.TextView
import androidx.test.core.app.takeScreenshot
import androidx.test.core.graphics.writeToTestStorage
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.PerformException
import androidx.test.espresso.UiController
import androidx.test.espresso.ViewAction
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withContentDescription
import androidx.test.espresso.util.HumanReadables
import androidx.test.rule.ActivityTestRule
import androidx.test.runner.AndroidJUnit4
import expo.modules.xmtpreactnativesdk.example.EspressoViewFinder.waitForDisplayed
import junit.framework.TestCase
import org.hamcrest.CoreMatchers.allOf
import org.hamcrest.Matcher
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestName
import org.junit.runner.RunWith
import java.util.concurrent.TimeoutException

@RunWith(AndroidJUnit4::class)
class MainActivityTest  {

    @JvmField
    @Rule var nameRule = TestName()

    @Rule
    @JvmField
    var activityRule = ActivityTestRule(MainActivity::class.java)

    @Test
    fun testRunTests() {
        waitForDisplayed(withContentDescription("Unit-tests")) { button ->
            // Go to unit tests page
            onView(button).perform(click())
            waitForDisplayed(withContentDescription("Test View")) { view ->
                waitForDisplayed(withContentDescription("tests-complete")) { complete ->
                    val failures = onView(allOf(withContentDescription("FAIL"), isDisplayed()))
                    if (failures.equals(true)) {
                        // Take a screenshot so we can see what failed in the UI
                        takeScreenshot().writeToTestStorage("${javaClass.simpleName}_${nameRule.methodName}")
                        TestCase.fail("Test failed")
                    }
                }
            }
        }
    }
}