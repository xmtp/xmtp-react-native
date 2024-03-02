import React, { useEffect, useState } from 'react'
import { View, Text, Button, ScrollView } from 'react-native'

import { tests, Test } from './tests'

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
    })()
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

export default function TestScreen(): JSX.Element {
  const [completedTests, setCompletedTests] = useState<number>(0)

  return (
    <ScrollView testID="test-screen" accessible={false}>
      <View>
        <View style={{ padding: 12 }}>
          <Text testID="Test View" accessible accessibilityLabel="Test View">
            Unit Tests
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text>
              Running {completedTests}/{tests.length}
            </Text>

            {completedTests === tests.length && (
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
          {(tests || []).slice(0, completedTests + 1).map((test: Test, i) => {
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
