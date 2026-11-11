import CircleHubSymbol from "@/components/circlehub-symbol";
import WalletConnectButton from "@/components/wallet-connect";
import CommunityCards from "@/components/community-cards";
const steps = [
  {
    number: "01",
    icon: "↗",
    title: "Create",
    description:
      "Bring your community together and give your shared goals a home.",
  },
  {
    number: "02",
    icon: "＋",
    title: "Collect",
    description:
      "Raise funds from members and supporters while tracking progress.",
  },
  {
    number: "03",
    icon: "✓",
    title: "Decide",
    description:
      "Submit spending proposals, vote together, and keep decisions accountable.",
  },
];

function Mark() {
  return (
    <a href="/" className="brand" aria-label="CircleHub home">
      <CircleHubSymbol className="brand-symbol" />
      <span>
        Circle<span className="brand-strong">Hub</span>
      </span>
    </a>
  );
}

function Button({
  children,
  href,
  secondary = false,
}: {
  children: React.ReactNode;
  href: string;
  secondary?: boolean;
}) {
  return (
    <a
      className={`button ${secondary ? "button-secondary" : ""}`}
      href={href}
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function DashboardPreview() {
  return (
    <div className="dashboard-scene">
      <div className="scene-orbit orbit-one" />
      <div className="scene-orbit orbit-two" />

      <div className="dashboard-window">
        <aside className="mini-sidebar">
          <div className="mini-brand">
            <CircleHubSymbol className="mini-logo-symbol" />
            CircleHub
          </div>

          <div className="mini-nav active">◫ &nbsp; Overview</div>
          <div className="mini-nav">◎ &nbsp; Communities</div>
          <div className="mini-nav">▦ &nbsp; Events</div>
          <div className="mini-nav">◷ &nbsp; Proposals</div>
          <div className="mini-nav">↗ &nbsp; Activity</div>

          <div className="sidebar-bottom">Community treasury</div>
        </aside>

        <div className="mini-main">
          <div className="mini-topline">
            <div>
              <span className="eyebrow">YOUR COMMUNITY</span>
              <h3>Tech Collective</h3>
            </div>

            <div className="avatar-stack">
              <span>A</span>
              <span>M</span>
              <span>T</span>
              <span>+9</span>
            </div>
          </div>

          <div className="balance-card">
            <div className="balance-head">
              <span>Treasury balance</span>
              <span className="live-pill">
                <i /> DEMO
              </span>
            </div>

            <div className="balance-amount">
              $3,420<span>.00</span>
            </div>

            <div className="balance-foot">
              <span className="growth">↗ Community funds</span>
              <span>USD</span>
            </div>

            <svg
              className="balance-chart"
              viewBox="0 0 420 76"
              preserveAspectRatio="none"
              aria-label="Illustrative treasury chart"
            >
              <path
                d="M0 63 L30 56 L57 60 L86 43 L113 48 L144 31 L174 40 L205 23 L238 34 L265 17 L294 25 L326 12 L352 20 L383 5 L420 10"
                fill="none"
                stroke="#397b57"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="mini-stat-row">
            <div className="mini-stat">
              <span>Raised so far</span>
              <strong>$3,420</strong>
              <small>of $5,000 goal</small>
            </div>

            <div className="mini-stat">
              <span>Contributors</span>
              <strong>24</strong>
              <small>community members</small>
            </div>
          </div>

          <div className="mini-activity">
            <div className="activity-title">
              <strong>Recent activity</strong>
              <span>View all ↗</span>
            </div>

            <div className="activity-line">
              <span className="activity-avatar">S</span>
              <span>
                <strong>Sarah contributed</strong>
                <small>Community contribution</small>
              </span>
              <b>+$200</b>
            </div>

            <div className="activity-line">
              <span className="activity-avatar activity-avatar-two">J</span>
              <span>
                <strong>Venue expense</strong>
                <small>Awaiting community vote</small>
              </span>
              <b className="pending-tag">Pending</b>
            </div>
          </div>
        </div>
      </div>

      <div className="floating-event">
        <div className="float-icon">✳</div>
        <span className="eyebrow">UPCOMING EVENT</span>
        <strong>Campus Tech Summit</strong>
        <small>Fundraising in progress</small>
        <div className="event-progress">
          <i />
        </div>
        <div className="event-progress-label">
          <b>$1,240 raised</b>
          <span>62%</span>
        </div>
      </div>

      <div className="floating-approval">
        <div className="approval-top">
          <span className="approval-icon">↗</span>
          <span className="eyebrow">SPENDING PROPOSAL</span>
        </div>

        <strong>Event venue</strong>
        <div className="approval-amount">$450.00</div>
        <div className="approval-status">Awaiting member votes</div>

        <div className="approval-votes">
          <span>● ● ● ● ○</span>
          <b>4 of 5</b>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      {/* NAVIGATION */}
      <header className="site-header">
        <div className="nav-inner">
          <Mark />

          <nav className="desktop-nav">
            <a href="#discover">Discover</a>
            <a href="#communities">Communities</a>
            <a href="#how-it-works">How it works</a>
          </nav>

          <div className="nav-actions">
            <a href="/dashboard" className="nav-login">
              Dashboard
            </a>
            <WalletConnectButton />
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero" id="discover">
        <div className="hero-glow" />

        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow">
              <span />
              COMMUNITY FINANCE, REIMAGINED
            </div>

            <h1>
              Stronger communities are <em>built together.</em>
            </h1>

            <p className="hero-description">
              Bring your community together to raise funds, make shared
              decisions, and manage money with clarity. Everything your
              collective needs, in one place.
            </p>

            <div className="hero-actions">
              <Button href="/create">
                Create a community
              </Button>

              <Button href="#communities" secondary>
                Explore communities
              </Button>
            </div>

            <div className="hero-social-proof">
              <div className="proof-avatars">
                <span>U</span>
                <span>C</span>
                <span>E</span>
                <span>+</span>
              </div>

              <div>
                <strong>Big goals start together.</strong>
                <span>
                  Built for communities that want to do more.
                </span>
              </div>
            </div>
          </div>

          <div className="group-illustration">
  <img
    src="/images/circlehub-hero-people-cropped.png"
    alt="A diverse group of people joining hands around a shared community fund"
    loading="eager"
  />
</div>
        </div>

        <div className="hero-bottom-note">
          <span>SCROLL TO EXPLORE</span>
          <span className="scroll-line" />
        </div>
      </section>

      {/* CORE BENEFITS */}
      <section className="principles">
        <div className="principle">
          <span className="principle-icon">◎</span>
          <div>
            <strong>Shared by everyone</strong>
            <p>One place for your community's funds.</p>
          </div>
        </div>

        <div className="principle">
          <span className="principle-icon">⌘</span>
          <div>
            <strong>Decided together</strong>
            <p>Make spending a collective decision.</p>
          </div>
        </div>

        <div className="principle">
          <span className="principle-icon">↗</span>
          <div>
            <strong>Transparent by design</strong>
            <p>Clear records of money in and out.</p>
          </div>
        </div>
      </section>

      {/* FEATURED COMMUNITIES */}
      <section
        className="communities-section section-wrap"
        id="communities"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">MADE FOR YOUR PEOPLE</span>

            <h2>
              Every community has
              <br />
              something worth building.
            </h2>

            <p>
              From campus clubs to creative collectives, give your next
              big idea a shared foundation.
            </p>
          </div>

        </div>

        <div className="communities-link-row">
          <a href="/communities" className="text-link">
            My communities <span>↗</span>
          </a>
        </div>

        <CommunityCards />
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how-it-works">
        <div className="section-wrap">
          <div className="how-heading">
            <span className="eyebrow">
              A BETTER WAY TO WORK TOGETHER
            </span>

            <h2>
              From shared ideas
              <br />
              to <em>shared impact.</em>
            </h2>

            <p>
              Less uncertainty. More trust. A clearer path from a good
              idea to getting it done.
            </p>
          </div>

          <div className="steps-grid">
            {steps.map((step) => (
              <article className="step-card" key={step.number}>
                <div className="step-top">
                  <span className="step-icon">{step.icon}</span>
                  <span className="step-number">{step.number}</span>
                </div>

                <h3>{step.title}</h3>
                <p>{step.description}</p>

                <div className="step-bottom">
                  <span>CircleHub</span>
                  <span>↗</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TRANSPARENCY */}
      <section className="transparency-section section-wrap">
        <div className="transparency-copy">
          <span className="eyebrow">BUILT AROUND TRUST</span>

          <h2>
            Your money.
            <br />
            Your community.
            <br />
            <em>Your say.</em>
          </h2>

          <p>
            Contributions should be clear. Spending should be accountable.
            And the people who make a community should have a voice in how
            it grows.
          </p>

          <a href="#how-it-works" className="text-link">
            See how it works <span>↗</span>
          </a>
        </div>

        <div className="transparency-visual">
          <div className="visual-ring ring-one" />
          <div className="visual-ring ring-two" />

          <div className="trust-card">
            <div className="trust-card-top">
              <span className="trust-check">✓</span>
              <span>COMMUNITY ACCOUNTABILITY</span>
            </div>

            <h3>Every decision has a story.</h3>

            <p>
              Keep track of contributions, proposals, votes, and approved
              expenses in one clear activity record.
            </p>

            <div className="trust-record">
              <span className="record-icon">＋</span>
              <span>
                <strong>Contribution received</strong>
                <small>Member contribution</small>
              </span>
              <b>Recorded</b>
            </div>

            <div className="trust-record">
              <span className="record-icon record-icon-two">✓</span>
              <span>
                <strong>Proposal approved</strong>
                <small>Community decision</small>
              </span>
              <b>Recorded</b>
            </div>

            <div className="trust-record">
              <span className="record-icon record-icon-three">↗</span>
              <span>
                <strong>Payment activity</strong>
                <small>Transaction history</small>
              </span>
              <b>Verifiable</b>
            </div>

            <div className="trust-footer">
              <span>Designed for transparent collaboration</span>
              <span>✳</span>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="cta-section">
        <div className="cta-pattern" />

        <div className="cta-inner">
          <span className="eyebrow">
            YOUR NEXT CHAPTER STARTS HERE
          </span>

          <h2>
            Your community.
            <br />
            Your goals. <em>Your future.</em>
          </h2>

          <p>
            Bring your people together and start building something
            that matters.
          </p>

          <Button href="/create">
            Start a community
          </Button>

          <span className="cta-footnote">
            A shared vision deserves a shared foundation.
          </span>
        </div>

        <div className="cta-decoration">
          <span>CH</span>
          <i />
          <i />
          <i />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Mark />
            <p>
              Good things happen when we build them together.
            </p>
          </div>

          <div className="footer-links">
            <strong>EXPLORE</strong>
            <a href="#communities">Communities</a>
            <a href="#how-it-works">How it works</a>
            <a href="/dashboard">Dashboard</a>
          </div>

          <div className="footer-links">
            <strong>GET STARTED</strong>
            <a href="/communities/create">Create a community</a>
            <a href="/communities">Discover groups</a>
            <a href="#discover">Back to top ↑</a>
          </div>

          <div className="footer-note">
            <span className="footer-orb">✳</span>
            <strong>Better together.</strong>
            <p>
              Community finance designed around people, participation,
              and trust.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 CircleHub. Built for communities.</span>

          <span className="footer-status">
            <i /> Community-first finance
          </span>

          <span>Powered by the idea of doing more together.</span>
        </div>
      </footer>
    </main>
  );
}
