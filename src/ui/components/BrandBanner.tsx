import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function BrandBanner() {
  return (
    <View style={styles.container}>
      <View style={styles.blueBox}>
        <Text style={styles.brandTitle}>فلوكس</Text>
      </View>
      <Text style={styles.brandSub}>منتج تسليك المجاري</Text>
      <View style={styles.orangeLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    marginVertical: 15,
    paddingHorizontal: 10,
  },
  blueBox: {
    backgroundColor: "#1E40AF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  brandTitle: {
    color: "#FFF",
    fontFamily: "CodecBold",
    fontSize: 14,
  },
  brandSub: {
    color: "#64748B",
    fontSize: 12,
    marginLeft: 10,
  },
  orangeLine: {
    position: "absolute",
    bottom: -10,
    right: 0,
    left: 0,
    height: 2,
    backgroundColor: "#F97316",
  }
});
