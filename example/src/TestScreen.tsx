import { useRoute } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
import { View, Text, Button, ScrollView } from 'react-native'

import { createdAtTests } from './tests/createdAtTests'
import { groupPermissionsTests } from './tests/groupPermissionsTests'
import { groupTests } from './tests/groupTests'
import { restartStreamTests } from './tests/restartStreamsTests'
import { Test } from './tests/test-utils'
import { tests } from './tests/tests'

type Result = 'waiting' | 'running' | 'success' | 'failure' | 'error'

function TestView({
  test,
  onComplete,
}: {
  test: Test
  onComplete: () => void
}): JSX.Element {
  const [markedComplete, setMarkedComplete] = useState<boolean>(false)
  const [result, setResult] = useState<Result>('waiting')
  const [errorMessage, setErrorMessage] = useState<string>('')

  async function run() {
    setResult('running')
    setErrorMessage('')
    try {
      const result = await test.run()
      setResult(result ? 'success' : 'failure')
      setErrorMessage('')
    } catch (err) {
      setResult('error')
      if (err instanceof Error) {
        setErrorMessage(err.message + '\n' + err.stack)
      } else {
        setErrorMessage(JSON.stringify(err))
      }
    }
    // delay a moment to avoid clobbering
    await new Promise((r) => setTimeout(r, 300))
    if (!markedComplete) {
      onComplete()
      setMarkedComplete(true)
    }
  }

  useEffect(() => {
    ;(async () => {
      await run()
    })().catch((e) => {
      console.error(e)
    })
  }, [test])

  const backgroundColor = {
    waiting: '#fafafa',
    success: '#d4edda',
    failure: '#f8d7da',
    error: '#f8d7da',
    running: '#fafafa',
  }[result]

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
          >
            Error: {errorMessage}
          </Text>
        </View>
      )}
    </View>
  )
}

export enum TestCategory {
  all = 'all',
  tests = 'tests',
  group = 'group',
  createdAt = 'createdAt',
  restartStreans = 'restartStreams',
  groupPermissions = 'groupPermissions',
}

export default function TestScreen(): JSX.Element {
  const [completedTests, setCompletedTests] = useState<number>(0)
  const route = useRoute()
  const params = route.params as {
    testSelection: TestCategory
  }
  const allTests = [
    ...tests,
    ...groupTests,
    ...createdAtTests,
    ...restartStreamTests,
    ...groupPermissionsTests,
  ]
  let activeTests, title
  switch (params.testSelection) {
    case TestCategory.all:
      activeTests = allTests
      title = 'All Unit Tests'
      break
    case TestCategory.tests:
      activeTests = tests
      title = 'Original Unit Tests'
      break
    case TestCategory.group:
      activeTests = groupTests
      title = 'Group Unit Tests'
      break
    case TestCategory.createdAt:
      activeTests = createdAtTests
      title = 'Created At Unit Tests'
      break
    case TestCategory.restartStreans:
      activeTests = restartStreamTests
      title = 'Restart Streams Unit Tests'
      break
    case TestCategory.groupPermissions:
      activeTests = groupPermissionsTests
      title = 'Group Permissions Unit Tests'
      break
  }

  return (
    <ScrollView>
      <View>
        <View style={{ padding: 12 }}>
          <Text testID="Test View" accessible accessibilityLabel="Test View">
            {title}
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text>
              Running {completedTests}/{activeTests.length}
            </Text>

            {completedTests === activeTests.length && (
              <Text
                testID="tests-complete"
                accessible
                accessibilityLabel="tests-complete"
              >
                Done
              </Text>
            )}
          </View>
        </View>
        <View
          testID="tests"
          accessible
          accessibilityLabel="tests-complete"
          style={{ paddingHorizontal: 12 }}
        >
          {(activeTests || [])
            .slice(0, completedTests + 1)
            .map((test: Test, i) => {
              return (
                <TestView
                  test={test}
                  onComplete={() => {
                    setCompletedTests((prev) => prev + 1)
                  }}
                  key={i}
                />
              )
            })}
        </View>
      </View>
    </ScrollView>
  )
}
