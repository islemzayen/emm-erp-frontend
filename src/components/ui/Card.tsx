export default function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="
      bg-white/40 
      backdrop-blur-lg 
      border border-white/50 
      shadow-lg 
      rounded-2xl 
      p-6 
      transition 
      hover:scale-[1.02]
    "
    >
      {children}
    </div>
  );
}
