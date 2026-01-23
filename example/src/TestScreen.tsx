import { useRoute } from '@react-navigation/native'
import React, { useEffect, useState, useMemo, JSX } from 'react'
import { View, Text, Button, ScrollView, Switch, TextInput } from 'react-native'

import { clientTests } from './tests/clientTests'
import { contentTypeTests } from './tests/contentTypeTests'
import { conversationTests } from './tests/conversationTests'
import { dmTests } from './tests/dmTests'
import { groupPerformanceTests } from './tests/groupPerformanceTests'
import { groupPermissionsTests } from './tests/groupPermissionsTests'
import { groupTests } from './tests/groupTests'
import { historySyncTests } from './tests/historySyncTests'
import { messagesTests } from './tests/messagesTests'
import { restartStreamTests } from './tests/restartStreamsTests'
import {
  Test,
  setDebugLoggingEnabled,
  getDebugLoggingEnabled,
} from './tests/test-utils'
type Result = 'waiting' | 'running' | 'success' | 'failure' | 'error'

function TestView({
  test,
  onComplete,
  autoRun = false,
}: {
  test: Test
  onComplete: (result: 'success' | 'failure' | 'error') => void
  autoRun?: boolean
}): JSX.Element {
  const [markedComplete, setMarkedComplete] = useState<boolean>(false)
  const [result, setResult] = useState<Result>('waiting')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showFullError, setShowFullError] = useState<boolean>(false)
  const [hasRunOnce, setHasRunOnce] = useState<boolean>(false)

  async function run() {
    setResult('running')
    setErrorMessage('')
    setShowFullError(false)
    try {
      const result = await test.run()
      const finalResult = result ? 'success' : 'failure'
      setResult(finalResult)
      setErrorMessage('')
      console.log(
        `✅ Test completed: ${test.name} - ${result ? 'PASSED' : 'FAILED'}`
      )
      // delay a moment to avoid clobbering
      await new Promise((r) => setTimeout(r, 300))
      if (!markedComplete) {
        onComplete(finalResult)
        setMarkedComplete(true)
      }
    } catch (err) {
      setResult('error')
      if (err instanceof Error) {
        setErrorMessage(err.message + '\n' + err.stack)
      } else {
        setErrorMessage(JSON.stringify(err))
      }
      console.log(`❌ Test failed: ${test.name} - ERROR`)
      console.error(`Error details for ${test.name}:`, err)
      // delay a moment to avoid clobbering
      await new Promise((r) => setTimeout(r, 300))
      if (!markedComplete) {
        onComplete('error')
        setMarkedComplete(true)
      }
    }
  }

  useEffect(() => {
    // Only run automatically if autoRun is explicitly true AND we haven't run once before
    // This prevents tests from running on reload when autoRun might be temporarily true
    if (autoRun && !hasRunOnce) {
      setHasRunOnce(true)
      ;(async () => {
        await run()
      })().catch((e) => {
        console.error(e)
      })
    }
  }, [test, autoRun, hasRunOnce])

  const backgroundColor = {
    waiting: '#fafafa',
    success: '#d4edda',
    failure: '#f8d7da',
    error: '#f8d7da',
    running: '#fafafa',
  }[result]

  const getTruncatedErrorMessage = (message: string) => {
    const lines = message.split('\n')
    if (lines.length <= 3) {
      return message
    }
    return lines.slice(0, 3).join('\n') + '\n...'
  }

  return (
    <View style={{ backgroundColor }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
        }}
      >
        <Text style={{ fontSize: 12 }}>{test.name}</Text>
        <Button
          onPress={async () => await run()}
          title={result === 'running' ? 'Running...' : 'Run'}
        />
      </View>
      {result === 'failure' && (
        <Text
          testID="FAIL"
          accessible
          accessibilityLabel="FAIL"
          style={{ paddingHorizontal: 12, paddingBottom: 12 }}
        >
          {test.name} failed
        </Text>
      )}
      {errorMessage && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <Text
            testID="FAIL"
            accessible
            accessibilityLabel="FAIL"
            style={{ color: '#721c24' }}
            numberOfLines={showFullError ? undefined : 3}
          >
            Error:{' '}
            {showFullError
              ? errorMessage
              : getTruncatedErrorMessage(errorMessage)}
          </Text>
          {errorMessage.split('\n').length > 3 && (
            <View style={{ marginTop: 4 }}>
              <Button
                onPress={() => setShowFullError(!showFullError)}
                title={showFullError ? 'Show Less' : 'Show More'}
              />
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export enum TestCategory {
  all = 'all',
  client = 'client',
  dm = 'dm',
  group = 'group',
  conversation = 'conversation',
  messages = 'messages',
  restartStreans = 'restartStreams',
  groupPermissions = 'groupPermissions',
  groupPerformance = 'groupPerformance',
  contentType = 'contentType',
  historySync = 'historySync',
}

export default function TestScreen(): JSX.Element {
  const [completedTests, setCompletedTests] = useState<number>(0)
  const [autoRun, setAutoRun] = useState<boolean>(false)
  const [testResults, setTestResults] = useState<{
    [key: string]: 'success' | 'failure' | 'error'
  }>({})
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [debugLogging, setDebugLogging] = useState<boolean>(
    getDebugLoggingEnabled()
  )
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const [testNumberInput, setTestNumberInput] = useState<string>('')
  const route = useRoute()
  const params = route.params as {
    testSelection: TestCategory
  }
  const allTests = [
    ...clientTests,
    ...dmTests,
    ...groupTests,
    ...conversationTests,
    ...messagesTests,
    ...restartStreamTests,
    ...groupPermissionsTests,
    ...contentTypeTests,
    ...historySyncTests,
  ]
  let activeTests, title
  switch (params.testSelection) {
    case TestCategory.all:
      activeTests = allTests
      title = 'All Unit Tests'
      break
    case TestCategory.client:
      activeTests = clientTests
      title = 'Client Unit Tests'
      break
    case TestCategory.dm:
      activeTests = dmTests
      title = 'Dm Unit Tests'
      break
    case TestCategory.group:
      activeTests = groupTests
      title = 'Group Unit Tests'
      break
    case TestCategory.conversation:
      activeTests = conversationTests
      title = 'Conversation Unit Tests'
      break
    case TestCategory.messages:
      activeTests = messagesTests
      title = 'Messages Unit Tests'
      break
    case TestCategory.restartStreans:
      activeTests = restartStreamTests
      title = 'Restart Streams Unit Tests'
      break
    case TestCategory.groupPermissions:
      activeTests = groupPermissionsTests
      title = 'Group Permissions Unit Tests'
      break
    case TestCategory.groupPerformance:
      activeTests = groupPerformanceTests
      title = 'Group Performance Unit Tests'
      break
    case TestCategory.contentType:
      activeTests = contentTypeTests
      title = 'Content Type Unit Tests'
      break
    case TestCategory.historySync:
      activeTests = historySyncTests
      title = 'History Sync Unit Tests'
      break
  }

  const runAllTests = () => {
    setAutoRun(true)
    setCompletedTests(0)
    setTestResults({})
    setStartTime(Date.now())
    setEndTime(null)
  }

  const resetTests = () => {
    setAutoRun(false)
    setCompletedTests(0)
    setTestResults({})
    setStartTime(null)
    setEndTime(null)
  }

  // Filter tests based on test number input - now computed with useMemo
  const filteredTests = useMemo(() => {
    if (!testNumberInput.trim()) {
      return activeTests
    }

    const testNumbers = testNumberInput
      .split(',')
      .map((num) => num.trim())
      .filter((num) => num !== '')
      .map((num) => parseInt(num, 10))
      .filter((num) => !isNaN(num) && num > 0)

    if (testNumbers.length === 0) {
      return activeTests
    }

    return activeTests.filter((_, index) => testNumbers.includes(index + 1))
  }, [testNumberInput, activeTests])

  // Ensure component is properly initialized and prevent auto-run on reload
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true)
      // Ensure we start in a clean state
      setAutoRun(false)
      setCompletedTests(0)
      setTestResults({})
      setStartTime(null)
      setEndTime(null)
    }
  }, [isInitialized])

  const getTestSummary = () => {
    if (!startTime || !endTime) return null

    const totalTests = filteredTests.length
    const passedTests = Object.values(testResults).filter(
      (result) => result === 'success'
    ).length
    const failedTests = Object.values(testResults).filter(
      (result) => result === 'failure' || result === 'error'
    ).length
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    const failedTestNames = Object.entries(testResults)
      .filter(([_, result]) => result === 'failure' || result === 'error')
      .map(([testName, result]) => `${testName} (${result})`)

    return {
      totalTests,
      passedTests,
      failedTests,
      duration,
      failedTestNames,
    }
  }

  const summary = getTestSummary()

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed Header */}
      <View
        style={{
          padding: 12,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#e0e0e0',
        }}
      >
        <Text testID="Test View" accessible accessibilityLabel="Test View">
          {title}
        </Text>

        {/* Test Number Input */}
        <View style={{ marginVertical: 8 }}>
          <Text style={{ fontSize: 12, marginBottom: 4, color: '#666' }}>
            Test Numbers (comma-separated, e.g., "1,3,5" or leave empty for
            all):
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 4,
              padding: 8,
              fontSize: 14,
              backgroundColor: '#fff',
            }}
            value={testNumberInput}
            onChangeText={setTestNumberInput}
            placeholder="1,2,3"
            keyboardType="numeric"
          />
        </View>

        {/* Debug Logging Toggle */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginVertical: 8,
          }}
        >
          <Text style={{ fontSize: 14 }}>Debug Console Logging</Text>
          <Switch
            value={debugLogging}
            onValueChange={(value) => {
              setDebugLogging(value)
              setDebugLoggingEnabled(value)
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginVertical: 8,
          }}
        >
          <Text>
            {autoRun
              ? `Running ${completedTests}/${filteredTests.length}`
              : `Ready to run ${filteredTests.length} tests`}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!autoRun && <Button onPress={runAllTests} title="Run All" />}
            {autoRun && completedTests === filteredTests.length && (
              <Text
                testID="tests-complete"
                accessible
                accessibilityLabel="tests-complete"
              >
                Done
              </Text>
            )}
            {autoRun && <Button onPress={resetTests} title="Reset" />}
          </View>
        </View>

        {/* Test Summary */}
        {summary && (
          <View
            style={{
              backgroundColor: summary.failedTests > 0 ? '#fff3cd' : '#d4edda',
              padding: 8,
              borderRadius: 4,
              marginTop: 8,
            }}
          >
            <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>
              Test Summary ({summary.duration}s)
            </Text>
            <Text>
              ✅ {summary.passedTests} passed | ❌ {summary.failedTests} failed
            </Text>
            {summary.failedTestNames.length > 0 && (
              <Text style={{ marginTop: 4, fontSize: 12, color: '#721c24' }}>
                Failed: {summary.failedTestNames.join(', ')}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Scrollable Test List */}
      <ScrollView style={{ flex: 1 }}>
        <View
          testID="tests"
          accessible
          accessibilityLabel="tests-complete"
          style={{ paddingHorizontal: 12 }}
        >
          {(filteredTests || [])
            .slice(0, autoRun ? completedTests + 1 : filteredTests.length)
            .map((test: Test, i) => {
              return (
                <TestView
                  test={test}
                  onComplete={(result) => {
                    if (autoRun) {
                      setCompletedTests((prev) => prev + 1)
                      setTestResults((prev) => ({
                        ...prev,
                        [test.name]: result,
                      }))

                      // Set end time when all tests are complete
                      if (completedTests + 1 === filteredTests.length) {
                        setEndTime(Date.now())
                      }
                    }
                  }}
                  autoRun={autoRun}
                  key={i}
                />
              )
            })}
        </View>
      </ScrollView>
    </View>
  )
}
