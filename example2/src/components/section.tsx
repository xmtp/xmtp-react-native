import { memo, useCallback, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Button from "./button";

type SectionProps = {
  title: string;
  result?: string | Error | null;
  onPress?: () => Promise<string | void> | string | void;
  buttonLabel?: string;
};

function Section(props: SectionProps) {
  const renderResult = useCallback(() => {
    const isError = props.result instanceof Error;
    return (
      <View
        style={[
          styles.resultContainer,
          {
            backgroundColor: isError ? "#ff000012" : "#00000008",
          },
        ]}
      >
        <Text
          style={{
            fontFamily: Platform.select({
              ios: "Courier",
              default: "monospace",
            }),
            color: isError ? "#ff0000" : "#000000",
          }}
        >
          {props.result instanceof Error ? props.result.message : props.result}
        </Text>
      </View>
    );
  }, [props.result]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={{ fontSize: 18, fontWeight: 500}}>{props.title}</Text>
        {props.onPress && (
          <Button
            title={props.buttonLabel || "Submit"}
            onPress={() => {
              props.onPress?.();
            }}
          />
        )}
      </View>
      {props.result && renderResult()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: "#00000012",
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    flexDirection: "column",
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
  },
  resultContainer: {
    backgroundColor: "#00000008",
    borderRadius: 8,
    padding: 8,
  },
});

export default memo(Section);
