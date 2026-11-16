// web/app/page.tsx
import { Suspense } from "react";

import { MentorChat } from "../components/mentor-chat";

// Home: the Selgo AI Mentor. Everyone lands here directly, no sign-in.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <MentorChat />
    </Suspense>
  );
}
