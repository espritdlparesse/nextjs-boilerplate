import type { Tab } from "@/app/types";
import { Dispatch, SetStateAction } from "react";

export function HomeTab({ tab, setTab, aboutStep, setAboutStep }: {
  tab: Tab;
  setTab: Dispatch<SetStateAction<Tab>>;
  aboutStep: number;
  setAboutStep: Dispatch<SetStateAction<number>>;
}) {
  return (
          <div className="card" style={{ background: aboutStep === 0 ? "#38C0FF" : aboutStep === 1 ? "#FF79D5" : "#49DE4E" }}>
            <div className="card-title">
              {aboutStep === 0 ? "твой культурный таймлайн" : aboutStep === 1 ? "добавляй как удобно" : "потом станет интереснее"}
            </div>
            <p className="card-text">
              {aboutStep === 0
                ? "сюда можно скидывать музыку, книги и фильмы, которые реально были с тобой. не список на потом, а след того, что происходило."
                : aboutStep === 1
                  ? "можно подключить сервис, загрузить скриншот, фотку книжной полки или просто вписать все вручную."
                  : "из этого собираются библиотека, календарь и вайбчек, который начинает замечать темы, периоды и сдвиги в настроении."}
            </p>

            {aboutStep === 0 ? (
              <div className="home-tiles" style={{ marginTop: 18 }}>
                <div className="home-tile" style={{ minHeight: 138, background: "#ffffff" }}>
                  <div className="home-tile-label">не вишлист</div>
                  <div className="home-tile-title">то, что было с тобой</div>
                </div>
                <div className="home-tile" style={{ minHeight: 138, background: "#FFC804" }}>
                  <div className="home-tile-label">в одном месте</div>
                  <div className="home-tile-title">музыка, книги, фильмы</div>
                </div>
              </div>
            ) : aboutStep === 1 ? (
              <div className="home-tiles" style={{ marginTop: 18 }}>
                <div className="home-tile tile-pink" style={{ minHeight: 138 }}><div className="home-tile-label">музыка</div><div className="home-tile-title">сервисы и плейлисты</div></div>
                <div className="home-tile tile-green" style={{ minHeight: 138 }}><div className="home-tile-label">все остальное</div><div className="home-tile-title">фото, csv и вручную</div></div>
              </div>
            ) : (
              <div className="home-tiles" style={{ marginTop: 18 }}>
                <div className="home-tile tile-blue" style={{ minHeight: 138 }}><div className="home-tile-label">библиотека</div><div className="home-tile-title">собирается сама</div></div>
                <div className="home-tile tile-yellow" style={{ minHeight: 138 }}><div className="home-tile-label">вайбчек</div><div className="home-tile-title">замечает сдвиги</div></div>
              </div>
            )}

            <div className="about-progress">
              {[0, 1, 2].map((step) => <div key={step} className={`about-progress-dot${step <= aboutStep ? " active" : ""}`} />)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {aboutStep > 0 ? <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAboutStep((step) => step - 1)}>назад</button> : null}
              <button className="btn" style={{ flex: 1 }} onClick={() => aboutStep === 2 ? setTab("profile") : setAboutStep((step) => step + 1)}>
                {aboutStep === 2 ? "к профилю" : "дальше"}
              </button>
            </div>
          </div>
        
  );
}
