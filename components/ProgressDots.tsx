export function ProgressDots({ done, goal, color }: { done: number; goal: number; color: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-3" aria-label={`${done} de ${goal} visitas`}>
      {Array.from({ length: goal }, (_, i) => (
        <span key={i} className="grid size-11 place-items-center rounded-full border-2 text-lg"
          style={{ borderColor: color, background: i < done ? color : "transparent", color: "white" }}>
          {i < done ? "✿" : ""}
        </span>
      ))}
    </div>
  );
}
