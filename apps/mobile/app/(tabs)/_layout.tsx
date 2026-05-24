import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import CaptureSheet from "../../components/CaptureSheet";

function CaptureTabButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} style={styles.captureBtnWrapper} accessibilityLabel="Capture">
      <View style={styles.captureBtn}>
        <Ionicons name="add" size={28} color="#fff" />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Tabs screenOptions={{ tabBarActiveTintColor: "#000", headerShown: false }}>
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="backlog"
          options={{
            title: "Backlog",
            tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="capture"
          options={{
            title: "",
            tabBarButton: () => <CaptureTabButton onOpen={() => setSheetOpen(true)} />,
          }}
        />
        <Tabs.Screen
          name="review"
          options={{
            title: "Review",
            tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
      <CaptureSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  captureBtnWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
});
