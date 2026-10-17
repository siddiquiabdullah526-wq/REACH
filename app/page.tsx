import { Brand } from "@/components/BrandMark";
import { TryCall } from "@/components/TryCall";

export default function Home() {
  return (
    <>
      <header className="site site-head">
        <Brand />
        <a className="btn quiet small" href="/dashboard">
          Coordinator sign in
        </a>
      </header>

      <main>
        <section className="site hero">
          <div>
            <h1>An alert isn’t finished until someone can act on it.</h1>
            <p className="lede">
              REACH calls residents in their own language, reads the approved notice word for word, checks they
              understood, and shows coordinators exactly who needs a person to follow up.
            </p>
            <div className="hero-actions">
              <TryCall />
            </div>
          </div>

          <figure className="callsheet" aria-label="Example call transcript">
            <div className="callsheet-head">
              <span>Simulated evacuation warning</span>
              <span>Call in Spanish, shown in English</span>
            </div>
            <ol className="turns">
              <li className="turn">
                <span className="who">REACH</span>
                <p className="said" lang="en">
                  …if you can’t leave on your own, tell us now. Can you follow these instructions, or do you need assistance?
                  <span className="tr" lang="es">…si no puede salir por su cuenta, díganoslo ahora. ¿Puede seguir estas instrucciones, o necesita ayuda?</span>
                </p>
              </li>
              <li className="turn resident">
                <span className="who">Resident</span>
                <p className="said" lang="en">
                  “I understand, but I don’t have a car, and my mother uses a wheelchair.”
                  <span className="tr" lang="es">Entiendo, pero no tengo carro, y mi mamá usa silla de ruedas.</span>
                </p>
              </li>
              <li className="turn">
                <span className="who">REACH</span>
                <p className="said" lang="en">
                  Let me read that back: you need transportation, and someone at home uses a wheelchair. Is that right?
                  <span className="tr" lang="es">Le confirmo: necesita transporte, y alguien en su hogar usa silla de ruedas. ¿Es correcto?</span>
                </p>
              </li>
            </ol>
            <div className="becomes">
              <span className="who">Coordinator</span>
              <div>
                <strong>Test Resident B needs help</strong>
                <span>Needs transportation, wheelchair user in household, needs confirmed on the call</span>
              </div>
            </div>
          </figure>
        </section>

        <section className="band">
          <div className="site">
            <h2>How it works</h2>
            <p>One loop, built for the moment a broadcast stops being enough.</p>
            <ol className="steps">
              <li>
                <h3>Send an approved notice</h3>
                <p>A coordinator picks a notice the issuing authority already approved, and the residents to reach.</p>
              </li>
              <li>
                <h3>REACH calls and checks</h3>
                <p>Each resident hears it in their language, says whether they can follow it, and hears their needs read back.</p>
              </li>
              <li>
                <h3>See who needs a person</h3>
                <p>The board sorts everyone into needs help, not reached, and heard it, with the reason for each.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="band">
          <div className="site">
            <h2>Who today’s alerts miss</h2>
            <p>Push alerts assume a smartphone, a data connection, and English. REACH uses a plain phone call, with a text as backup.</p>
            <div className="missed">
              <div>
                <strong>No smartphone</strong>
                <span>Any phone that rings works, including landlines.</span>
              </div>
              <div>
                <strong>Weak or no data</strong>
                <span>Voice and SMS run on the cell network, not apps.</span>
              </div>
              <div>
                <strong>Not English</strong>
                <span>Each resident is called in their preferred language.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="site two-col">
            <div>
              <h3>When the network goes down</h3>
              <p>
                No phone system works through a full outage, and REACH doesn’t pretend to. Every household it can’t reach
                stays on the board with the reason, and that list prints as a door-knock list for building staff.
              </p>
            </div>
            <div>
              <h3>Built to be used responsibly</h3>
              <p>
                Only approved notices can be sent. The agent says it’s automated, never promises that help is coming, and
                stops calling anyone who asks. Hearing a notice is not the same as being safe, and the board says so.
              </p>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="site two-col">
            <div>
              <h3>Same loop, anywhere</h3>
              <p>
                Languages, time zone, alert authority and consent rules live in a region config, not in the code. Our example
                second region is Odisha, India, where cyclone warnings need to reach households on basic phones in Hindi.
              </p>
            </div>
            <div>
              <h3>How it gets funded</h3>
              <p>
                NSF SBIR/STTR Phase I for the research, with Cal Poly Pomona as an STTR partner, then city and county buyers
                using FEMA Homeland Security Grant (UASI) funds for deployments.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site site-foot">
        <span>Built at the Dual-Use Hackathon, USC Viterbi × InnovateLA, by Rafid, Enzo and Abdullah.</span>
        <span>All demo calls use simulated notices and consented test numbers.</span>
      </footer>
    </>
  );
}
