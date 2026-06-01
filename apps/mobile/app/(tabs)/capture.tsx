import { useAuth } from "@clerk/clerk-expo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { uploadPhoto } from "../../src/photo-upload";

type UploadStatus = "idle" | "uploading" | "done" | "error";

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const { getToken } = useAuth();

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera access is needed to capture photos.</Text>
        <Button title="Grant permission" onPress={requestPermission} />
      </View>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || uploadStatus === "uploading") return;
    setUploadStatus("uploading");
    setErrorMsg(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error("No photo captured");
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await uploadPhoto(token, photo.uri, "capture.jpg");
      setUploadStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Upload failed");
      setUploadStatus("error");
    }
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />
      <View style={styles.controls}>
        {uploadStatus === "uploading" && <Text style={styles.statusText}>Uploading…</Text>}
        {uploadStatus === "done" && <Text style={styles.statusText}>Capture saved!</Text>}
        {uploadStatus === "error" && (
          <Text style={[styles.statusText, styles.error]}>Error: {errorMsg}</Text>
        )}
        <Button
          title={uploadStatus === "uploading" ? "Uploading…" : "Capture"}
          onPress={handleCapture}
          disabled={uploadStatus === "uploading"}
        />
        {uploadStatus === "done" && (
          <Button title="Capture another" onPress={() => setUploadStatus("idle")} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  camera: { flex: 1 },
  controls: { padding: 16, alignItems: "center", gap: 8 },
  message: { textAlign: "center", marginBottom: 12 },
  statusText: { fontSize: 14 },
  error: { color: "red" },
});
