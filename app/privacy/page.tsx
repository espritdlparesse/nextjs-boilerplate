export default function PrivacyPage() {
  return (
    <div style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "40px 24px 80px",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      color: "#1a1a1a",
      lineHeight: 1.7,
    }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>everyyou · @every_you_bot</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Privacy Policy</h1>
        <div style={{ fontSize: 13, color: "#aaa" }}>Effective date: March 10, 2026</div>
      </div>

      {/* ENGLISH */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, paddingBottom: 8, borderBottom: "1px solid #eee" }}>🇬🇧 English</h2>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>1. What we collect</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          When you use every you, we collect the following data:
        </p>
        <ul style={{ fontSize: 14, color: "#444", paddingLeft: 20 }}>
          <li>Your Telegram user ID and username (provided automatically by Telegram)</li>
          <li>Content you add: titles, creators, and types of music, books, and movies</li>
          <li>Spotify listening history if you choose to connect your Spotify account</li>
          <li>Purchase records if you buy a paid feature via Telegram Stars</li>
        </ul>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>2. How we use your data</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          We use your data exclusively to provide the app's features: storing your content library,
          generating AI-based vibe checks, and processing payments. We do not sell, share, or transfer
          your data to third parties, except as required to operate the service (Supabase for database
          hosting, OpenAI for AI analysis, Spotify for music import).
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>3. Data storage</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          Your data is stored securely on Supabase servers (EU region). We retain your data as long as
          you use the app. You can request deletion at any time by contacting us.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>4. Third-party services</h3>
        <ul style={{ fontSize: 14, color: "#444", paddingLeft: 20 }}>
          <li><b>Telegram</b> — authentication and payments (Telegram Stars)</li>
          <li><b>Supabase</b> — database hosting</li>
          <li><b>OpenAI</b> — AI analysis of your content (no personal identifiers are sent)</li>
          <li><b>Spotify</b> — music import (only if you explicitly connect your account)</li>
        </ul>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>5. Payments</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          Paid features are processed exclusively through Telegram Stars. We do not collect or store
          any payment card information. For payment issues, use the /paysupport command in the bot
          or contact us at the address below.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>6. Your rights</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          You have the right to access, correct, or delete your personal data at any time.
          To exercise these rights, contact us via Telegram: <b>@espritdlparesse</b>.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>7. Contact</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          If you have any questions about this Privacy Policy, please contact us:<br />
          Telegram: <b>@espritdlparesse</b>
        </p>
      </section>

      <div style={{ height: 1, background: "#eee", marginBottom: 48 }} />

      {/* RUSSIAN */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, paddingBottom: 8, borderBottom: "1px solid #eee" }}>🇷🇺 Русский</h2>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>1. Какие данные мы собираем</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          При использовании every you мы собираем следующие данные:
        </p>
        <ul style={{ fontSize: 14, color: "#444", paddingLeft: 20 }}>
          <li>Ваш Telegram ID и имя пользователя (передаются автоматически Telegram)</li>
          <li>Контент, который вы добавляете: названия, авторы и типы музыки, книг, фильмов</li>
          <li>История прослушиваний Spotify — если вы подключите свой аккаунт</li>
          <li>Записи о покупках при оплате функций через Telegram Stars</li>
        </ul>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>2. Как мы используем ваши данные</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          Мы используем данные исключительно для работы приложения: хранения вашей библиотеки,
          генерации вайбчека на основе ИИ и обработки платежей. Мы не продаём, не передаём и не
          раскрываем ваши данные третьим лицам, кроме случаев, необходимых для работы сервиса
          (Supabase — хранение данных, OpenAI — ИИ-анализ, Spotify — импорт музыки).
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>3. Хранение данных</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          Ваши данные надёжно хранятся на серверах Supabase (регион EU). Мы храним данные пока
          вы пользуетесь приложением. Вы можете запросить удаление в любой момент, связавшись с нами.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>4. Сторонние сервисы</h3>
        <ul style={{ fontSize: 14, color: "#444", paddingLeft: 20 }}>
          <li><b>Telegram</b> — авторизация и платежи (Telegram Stars)</li>
          <li><b>Supabase</b> — хранение данных</li>
          <li><b>OpenAI</b> — ИИ-анализ контента (персональные данные не передаются)</li>
          <li><b>Spotify</b> — импорт музыки (только если вы явно подключили аккаунт)</li>
        </ul>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>5. Платежи</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          Платные функции оплачиваются исключительно через Telegram Stars. Мы не собираем и не
          храним данные банковских карт. По вопросам оплаты используйте команду /paysupport в боте
          или свяжитесь с нами по адресу ниже.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>6. Ваши права</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          Вы вправе в любой момент запросить доступ к своим данным, их исправление или удаление.
          Для этого напишите нам в Telegram: <b>@espritdlparesse</b>.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>7. Контакты</h3>
        <p style={{ fontSize: 14, color: "#444" }}>
          По всем вопросам, связанным с политикой конфиденциальности, обращайтесь:<br />
          Telegram: <b>@espritdlparesse</b>
        </p>
      </section>

      <div style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid #eee", fontSize: 12, color: "#bbb", textAlign: "center" }}>
        every you · @every_you_bot · 2026
      </div>
    </div>
  );
}
