package expo.modules.xmtpreactnativesdk.example

import android.view.View
import android.widget.TextView
import androidx.test.espresso.PerformException
import androidx.test.espresso.UiController
import androidx.test.espresso.ViewAction
import androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom
import androidx.test.espresso.util.HumanReadables
import org.hamcrest.Matcher
import java.util.concurrent.TimeoutException

class WaitForTextAction(
    private val text: String,
    private val timeout: Long,
) : ViewAction {

    override fun getConstraints(): Matcher<View> {
        return isAssignableFrom(TextView::class.java)
    }

    override fun getDescription(): String {
        return "wait up to $timeout milliseconds for the view to have text $text"
    }

    override fun perform(uiController: UiController, view: View) {
        val endTime = System.currentTimeMillis() + timeout

        do {
            if ((view as? TextView)?.text == text) return
            uiController.loopMainThreadForAtLeast(50)
        } while (System.currentTimeMillis() < endTime)

        throw PerformException.Builder()
            .withActionDescription(description)
            .withCause(TimeoutException("Waited $timeout milliseconds"))
            .withViewDescription(HumanReadables.describe(view))
            .build()
    }
}