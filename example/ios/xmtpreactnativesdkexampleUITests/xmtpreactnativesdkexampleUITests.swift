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

  func testExample() throws {
    // UI tests must launch the application that they test.
    let app = XCUIApplication()
    app.launch()

    let button = app.buttons["Enable Test Mode"]
    XCTAssert(button.waitForExistence(timeout: 3))
    button.tap()

    let view = app.staticTexts["Test View"]
    XCTAssert(view.waitForExistence(timeout: 3))

    let result = app.staticTexts["result"]
    XCTAssert(result.waitForExistence(timeout: 3))

    let input = app.textFields["input"]
    XCTAssert(input.waitForExistence(timeout: 3))
    
  }

}
