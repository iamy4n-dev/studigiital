import * as Network from "expo-network";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { TransformResponse } from "@studigiital/api-client";
import type { learning_type } from "@studigiital/api-client";
import { useUser } from "@clerk/clerk-expo";

import { getPlaceholder } from "../src/capture-placeholder";
import type { CaptureMode } from "../src/capture-mode-prefs";
import { getLastMode, initModePrefs, setLastMode } from "../src/capture-mode-prefs";
import { initQueue } from "../src/capture-queue";
import { submitCapture } from "../src/capture-submit";
import { useSession } from "../src/session";

type Phase =
  | { id: "mode_picker" }
  | { id: "quick_text" }
  | { id: "submitting" }
  | { id: "result"; result: TransformResponse }
  | { id: "queued" }
  | { id: "error"; message: string };

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CaptureSheet({ visible, onClose }: Props) {
  const { tier } = useSession();
  const { user } = useUser();
  const learningType = (user?.publicMetadata?.learning_type as learning_type | undefined) ?? null;

  const [phase, setPhase] = useState<Phase>({ id: "mode_picker" });
  const [text, setText] = useState("");
  const [defaultMode, setDefaultMode] = useState<CaptureMode>("quick_text");

  useEffect(() => {
    initQueue().catch(() => {});
    initModePrefs()
      .then(() => getLastMode())
      .then(setDefaultMode)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (visible) {
      setText("");
      setPhase(defaultMode === "quick_text" ? { id: "quick_text" } : { id: "mode_picker" });
    }
  }, [visible, defaultMode]);

  async function handleSubmit() {
    if (!text.trim()) return;
    setPhase({ id: "submitting" });

    const networkState = await Network.getNetworkStateAsync().catch(() => ({ isConnected: true, isInternetReachable: true }));
    const isOnline = !!(networkState.isConnected && networkState.isInternetReachable !== false);

    const result = await submitCapture(text.trim(), "quick_text", tier, isOnline);

    if (result.status === "success") {
      setPhase({ id: "result", result: result.result });
    } else if (result.status === "queued") {
      setPhase({ id: "queued" });
    } else {
      setPhase({ id: "error", message: result.message });
    }
  }

  async function pickMode(mode: CaptureMode) {
    await setLastMode(mode).catch(() => {});
    setDefaultMode(mode);
    if (mode === "quick_text") {
      setPhase({ id: "quick_text" });
    } else {
      onClose();
    }
  }

  function handleClose() {
    setPhase({ id: "mode_picker" });
    setText("");
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        {phase.id === "mode_picker" && (
          <ModePicker onPick={pickMode} onClose={handleClose} />
        )}
        {phase.id === "quick_text" && (
          <QuickTextInput
            text={text}
            onChange={setText}
            placeholder={getPlaceholder(learningType)}
            onSubmit={handleSubmit}
            onBack={() => setPhase({ id: "mode_picker" })}
          />
        )}
        {phase.id === "submitting" && (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.hint}>Creating your flashcard…</Text>
          </View>
        )}
        {phase.id === "result" && (
          <ResultPreview result={phase.result} onDone={handleClose} />
        )}
        {phase.id === "queued" && (
          <View style={styles.centred}>
            <Text style={styles.title}>Saved for later</Text>
            <Text style={styles.hint}>Your flashcard will be ready when you're back online.</Text>
            <Pressable style={styles.btn} onPress={handleClose}>
              <Text style={styles.btnLabel}>Done</Text>
            </Pressable>
          </View>
        )}
        {phase.id === "error" && (
          <View style={styles.centred}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.hint}>{phase.message}</Text>
            <Pressable style={styles.btn} onPress={() => setPhase({ id: "quick_text" })}>
              <Text style={styles.btnLabel}>Try again</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ModePicker({ onPick, onClose }: { onPick: (m: CaptureMode) => void; onClose: () => void }) {
  return (
    <View>
      <View style={styles.handleBar} />
      <Text style={styles.sheetTitle}>Capture</Text>
      {(["quick_text", "photo", "backlog"] as CaptureMode[]).map((mode) => (
        <Pressable key={mode} style={styles.modeRow} onPress={() => onPick(mode)}>
          <Text style={styles.modeLabel}>{MODE_LABELS[mode]}</Text>
          <Text style={styles.modeDesc}>{MODE_DESCS[mode]}</Text>
        </Pressable>
      ))}
      <Pressable style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function QuickTextInput({
  text,
  onChange,
  placeholder,
  onSubmit,
  onBack,
}: {
  text: string;
  onChange: (t: string) => void;
  placeholder: string;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <View>
      <View style={styles.handleBar} />
      <View style={styles.row}>
        <Pressable onPress={onBack}>
          <Text style={styles.backLabel}>‹ Back</Text>
        </Pressable>
        <Text style={styles.sheetTitle}>Quick Text</Text>
        <View style={{ width: 48 }} />
      </View>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={4}
        placeholder={placeholder}
        value={text}
        onChangeText={onChange}
        autoFocus
      />
      <Pressable
        style={[styles.btn, !text.trim() && styles.btnDisabled]}
        onPress={onSubmit}
        disabled={!text.trim()}
      >
        <Text style={styles.btnLabel}>Submit</Text>
      </Pressable>
    </View>
  );
}

function ResultPreview({ result, onDone }: { result: TransformResponse; onDone: () => void }) {
  return (
    <ScrollView>
      <View style={styles.handleBar} />
      <Text style={styles.sheetTitle}>Your flashcard{result.cards.length !== 1 ? "s" : ""}</Text>
      {result.cards.map((card, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardFront}>{card.front}</Text>
          <View style={styles.divider} />
          <Text style={styles.cardBack}>{card.back}</Text>
        </View>
      ))}
      {result.source_summary ? (
        <Text style={styles.summary}>{result.source_summary}</Text>
      ) : null}
      <Pressable style={styles.btn} onPress={onDone}>
        <Text style={styles.btnLabel}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const MODE_LABELS: Record<CaptureMode, string> = {
  quick_text: "Quick Text",
  photo: "Photo",
  backlog: "Backlog",
};

const MODE_DESCS: Record<CaptureMode, string> = {
  quick_text: "Type or paste something you just learned",
  photo: "Snap a note, page, or whiteboard",
  backlog: "Add to your backlog for later",
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  handleBar: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backLabel: { fontSize: 16, color: "#555", width: 48 },
  modeRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  modeLabel: { fontSize: 16, fontWeight: "500" },
  modeDesc: { fontSize: 13, color: "#888", marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  btn: {
    backgroundColor: "#000",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.3 },
  btnLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ddd" },
  cancelLabel: { color: "#333", fontSize: 16 },
  centred: { alignItems: "center", paddingVertical: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: "600" },
  hint: { fontSize: 14, color: "#666", textAlign: "center" },
  card: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardFront: { fontSize: 15, fontWeight: "500" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#e5e5e5", marginVertical: 10 },
  cardBack: { fontSize: 15, color: "#444" },
  summary: { fontSize: 13, color: "#888", marginBottom: 16, fontStyle: "italic" },
});
