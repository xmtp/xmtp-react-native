package expo.modules.xmtpreactnativesdk.example

import android.util.Log
import androidx.test.core.app.takeScreenshot
import androidx.test.core.graphics.writeToTestStorage
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.matcher.ViewMatchers.withContentDescription
import androidx.test.rule.ActivityTestRule
import androidx.test.runner.AndroidJUnit4
import expo.modules.xmtpreactnativesdk.example.EspressoViewFinder.waitForDisplayed
import junit.framework.TestCase
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestName
import org.junit.runner.RunWith


@RunWith(AndroidJUnit4::class)
class MainActivityTest {

    @get:Rule
    val activityRule = ActivityTestRule(MainActivity::class.java)

    @get:Rule
    val nameRule = TestName()

    @Test
    fun testRunTests() {
        waitForDisplayed(withContentDescription("Unit-tests")) { button ->
            // Go to unit tests page
            onView(button).perform(click())
            waitForDisplayed(withContentDescription("Test View")) { view ->
                // Click "Run All" button to start the tests
                waitForDisplayed(withContentDescription("Run All")) { runAllButton ->
                    onView(runAllButton).perform(click())
                    waitForDisplayed(withContentDescription("tests-complete")) { complete ->
                        try {
                            waitForDisplayed(withContentDescription("FAIL")) { failure ->
                                takeScreenshot().writeToTestStorage("${javaClass.simpleName}_${nameRule.methodName}")
                                Log.d("MainActivityTest", "Test Fail")
                                TestCase.fail("Test failed")
                            }
                        } catch (e: Exception) {
                            Log.d("MainActivityTest", "Test Succeeded $e")
                        }
                    }
                }
            }
        }
    }
}
