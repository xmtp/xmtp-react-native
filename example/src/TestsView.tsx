import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, ScrollView } from "react-native";
import * as XMTP from "../../src/index";
import { tests, Test } from "./tests";

type Result = "waiting" | "running" | "success" | "failure" | "error";

function TestView({ test }: { test: Test }): JSX.Element {
  const [result, setResult] = useState<Result>("waiting");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function run() {
    setResult("running");
    setErrorMessage("");
    try {
      const result = await test.run();
      setResult(result ? "success" : "failure");
      setErrorMessage("");
    } catch (err) {
      setResult("error");
      if (err instanceof Error) {
        setErrorMessage(err.message + "\n" + err.stack);
      } else {
        setErrorMessage(JSON.stringify(err));
      }
    }
  }

  useEffect(() => {
    (async () => {
      await run();
    })();
  }, [test]);

  const backgroundColor = {
    waiting: "#fafafa",
    success: "#d4edda",
    failure: "#f8d7da",
    error: "#f8d7da",
    running: "#fafafa",
  }[result];

  return (
    <View style={{ backgroundColor: backgroundColor }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
        }}
      >
        <Text style={{ fontSize: 12 }}>{test.name}</Text>
        <Button
          onPress={async () => await run()}
          title={result == "running" ? "Running..." : "Run"}
        />
      </View>
      {errorMessage && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <Text style={{ color: "#721c24" }}>Error: {errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

export default function TestsView(): JSX.Element {
  const [text, setText] = useState<string>("");

  return (
    <ScrollView>
      <View>
        <View style={{ padding: 12 }}>
          <Text>Test View</Text>
          <Text testID="Test View">This view is used by unit tests.</Text>
        </View>
        <View testID="tests" style={{ paddingHorizontal: 12 }}>
          {tests.map((test: Test, i) => {
            return <TestView test={test} key={i} />;
          })}
        </View>
      </View>
    </ScrollView>
  );
}
