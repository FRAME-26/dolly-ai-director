/** Live interim transcript while Dolly is listening. */
export function VoiceTranscript({ interim }: { interim: string }) {
  if (!interim) return null;
  return (
    <p className="text-center font-mono text-[16px] font-medium text-text-muted-dark opacity-70">
      … {interim}
    </p>
  );
}
