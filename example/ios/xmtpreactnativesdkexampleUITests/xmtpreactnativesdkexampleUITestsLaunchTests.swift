//
//  xmtpreactnativesdkexampleUITestsLaunchTests.swift
//  xmtpreactnativesdkexampleUITests
//
//  Created by Pat Nakajima on 5/1/23.
//

import XCTest

final class xmtpreactnativesdkexampleUITestsLaunchTests: XCTestCase {

    override class var runsForEachTargetApplicationUIConfiguration: Bool {
        true
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunch() throws {
        let app = XCUIApplication()
        app.launch()

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Launch Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
