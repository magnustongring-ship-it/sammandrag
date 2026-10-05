"use client";

// Visas om själva layouten kraschar; ersätter hela sidan, därför egen html/body.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="sv">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "4rem 1rem",
        }}
      >
        <h1>Något gick fel</h1>
        <p>Sammandrag kunde inte laddas. Försök igen om en stund.</p>
        <button onClick={() => retry()} style={{ padding: "0.5rem 1rem" }}>
          Försök igen
        </button>
      </body>
    </html>
  );
}
