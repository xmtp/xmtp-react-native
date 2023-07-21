//
//  xmtpreactnativesdkexampleUITests.swift
//  xmtpreactnativesdkexampleUITests
//
//  Created by Pat Nakajima on 5/1/23.
//

import XCTest

final class xmtpreactnativesdkexampleUITests: XCTestCase {

  override func setUpWithError() throws {
    // Put setup code here. This method is called before the invocation of each test method in the class.

    // In UI tests it is usually best to stop immediately when a failure occurs.
    continueAfterFailure = false

    // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
  }

  func testRunTests() throws {
    // UI tests must launch the application that they test.
    let app = XCUIApplication()
    app.launch()

    // Go to unit tests page
    let button = app.buttons["Unit tests"]
    XCTAssert(button.waitForExistence(timeout: 3))
    button.tap()

    // Make sure we're there
    let view = app.staticTexts["Test View"]
    XCTAssert(view.waitForExistence(timeout: 3))

    // Wait for tests to complete
    let complete = app.staticTexts["tests-complete"]
    XCTAssert(complete.waitForExistence(timeout: 5))

    // See if we have any failures
    if app.staticTexts["FAIL"].waitForExistence(timeout: 3) {
      // Take a screenshot so we can see what failed in the UI
      let screenshot = app.windows.firstMatch.screenshot()
      let attachment = XCTAttachment(screenshot: screenshot)
      attachment.lifetime = .keepAlways
      add(attachment)

      XCTFail("Tests failed.")
    }
  }

}
