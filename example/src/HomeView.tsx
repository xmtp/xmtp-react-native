import React from "react";
import { Text, ScrollView } from "react-native";

import HomeHeaderView from "./HomeHeaderView";

const HomeView = () => {
  return (
    <>
      <HomeHeaderView />
      <ScrollView>
        <Text>Convo list goes here</Text>
      </ScrollView>
    </>
  );
};

export default HomeView;
