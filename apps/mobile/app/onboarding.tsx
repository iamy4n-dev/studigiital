import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type LearningType = "language_learner" | "professional" | "student" | "generic";

const QUESTIONS: Array<{
  question: string;
  options: Array<{ label: string; value: LearningType }>;
}> = [
  {
    question: "What best describes you?",
    options: [
      { label: "Student", value: "student" },
      { label: "Professional", value: "professional" },
      { label: "Language learner", value: "language_learner" },
      { label: "Just exploring", value: "generic" },
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<LearningType | null>(null);

  const current = QUESTIONS[step];
  if (!current) return null;

  async function handleSelect(value: LearningType) {
    setSelected(value);
    await saveProfile(value);
    router.replace("/");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {step + 1} / {QUESTIONS.length}
      </Text>
      <Text style={styles.question}>{current.question}</Text>

      <View style={styles.options}>
        {current.options.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.option, selected === opt.value && styles.optionSelected]}
            onPress={() => handleSelect(opt.value)}
          >
            <Text
              style={[
                styles.optionText,
                selected === opt.value && styles.optionTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

async function saveProfile(learningType: LearningType): Promise<void> {
  // Profile is persisted via POST /api/v1/users/profile when backend is reachable.
  // Offline: the capture queue (#6) will retry; for now we fire-and-forget.
  try {
    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learning_type: learningType }),
    });
  } catch {
    // Non-fatal — profile can be re-submitted on next open
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    paddingTop: 80,
    backgroundColor: "#fff",
  },
  progress: { fontSize: 13, color: "#999", marginBottom: 24 },
  question: { fontSize: 24, fontWeight: "700", marginBottom: 32 },
  options: { gap: 12 },
  option: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  optionSelected: { borderColor: "#000", backgroundColor: "#000" },
  optionText: { fontSize: 16 },
  optionTextSelected: { color: "#fff", fontWeight: "600" },
});
