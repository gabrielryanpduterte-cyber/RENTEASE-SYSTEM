import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Home,
  Menu,
  MessageCircle,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';
import RoomCard from '../components/design/RoomCard.jsx';
import { boardingHouseApi, roomsApi } from '../api/client.js';
import { buildPropertyListings } from '../utils/propertyBrowse.js';
import {
  faqs,
  featuredRooms as fallbackFeaturedRooms,
  featureImages,
  publicHeroImage,
} from '../data/renteaseContent.js';

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Properties', href: '/properties' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

const SUPPORT_EMAIL = 'renteasesupport@gmail.com';

const workflowItems = [
  {
    icon: Building2,
    title: 'Compare listings',
    description: 'Browse properties and available rooms with clear rates, capacity, and basic amenities.',
  },
  {
    icon: CalendarCheck,
    title: 'Handle requests',
    description: 'Let seekers reserve rooms while landlords review approvals and tenant status in one place.',
  },
  {
    icon: MessageCircle,
    title: 'Share access',
    description: 'Seekers can generate guardian links for read-only room and rent visibility when needed.',
  },
];

function PublicNav({ scrolled, mobileOpen, setMobileOpen }) {
  const navigate = useNavigate();

  return (
    <nav className={`re-public-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="re-public-nav-inner">
        <Link to="/" className="re-brand" onClick={() => setMobileOpen(false)}>
          <span>
            <Home size={20} />
          </span>
          RentEase
        </Link>

        <div className="re-nav-links">
          {navLinks.map((item) =>
            item.href.startsWith('#') ? (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ) : (
              <Link key={item.label} to={item.href}>
                {item.label}
              </Link>
            ),
          )}
        </div>

        <div className="re-nav-actions">
          <button type="button" className="re-btn re-btn-ghost" onClick={() => navigate('/login')}>
            Login
          </button>
          <button type="button" className="re-btn re-btn-gold" onClick={() => navigate('/register')}>
            Get Started
          </button>
        </div>

        <button
          type="button"
          className="re-mobile-menu-button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="re-mobile-menu">
          {navLinks.map((item) =>
            item.href.startsWith('#') ? (
              <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)}>
                {item.label}
              </a>
            ) : (
              <Link key={item.label} to={item.href} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            ),
          )}
          <button type="button" onClick={() => navigate('/login')}>
            Login
          </button>
          <button type="button" onClick={() => navigate('/register')}>
            Get Started
          </button>
        </div>
      )}
    </nav>
  );
}

export default function RentEaseLanding() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [landingData, setLandingData] = useState({
    houses: [],
    rooms: [],
    loading: true,
    error: '',
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadLandingData() {
      try {
        const [housesPayload, roomsPayload] = await Promise.all([
          boardingHouseApi.list(),
          roomsApi.list({ availability_status: 'available', include_archived: 0 }),
        ]);

        if (!isActive) {
          return;
        }

        setLandingData({
          houses: Array.isArray(housesPayload.data) ? housesPayload.data : [],
          rooms: Array.isArray(roomsPayload.data) ? roomsPayload.data : [],
          loading: false,
          error: '',
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLandingData({
          houses: [],
          rooms: [],
          loading: false,
          error: error?.errors?.[0] || error?.message || 'Live listings are currently unavailable.',
        });
      }
    }

    queueMicrotask(loadLandingData);

    return () => {
      isActive = false;
    };
  }, []);

  const properties = useMemo(
    () => buildPropertyListings(landingData.houses, landingData.rooms),
    [landingData.houses, landingData.rooms],
  );

  const availableRooms = useMemo(
    () => properties.flatMap((property) => property.availableRooms),
    [properties],
  );

  const featuredRoomCards = availableRooms.length > 0
    ? availableRooms.slice(0, 3)
    : fallbackFeaturedRooms.slice(0, 3);

  const totalRoomTypes = new Set(
    properties.flatMap((property) => property.roomTypes).filter(Boolean),
  ).size;

  const liveStats = [
    {
      label: 'Listed properties',
      value: landingData.loading ? '...' : String(properties.length),
    },
    {
      label: 'Available rooms',
      value: landingData.loading ? '...' : String(availableRooms.length),
    },
    {
      label: 'Room types',
      value: landingData.loading ? '...' : String(totalRoomTypes),
    },
    {
      label: 'Guardian links',
      value: 'Secure',
    },
  ];

  return (
    <main className="re-public-page">
      <PublicNav scrolled={scrolled} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <section
        id="home"
        className="re-hero"
        style={{ '--hero-image': `url(${publicHeroImage})` }}
      >
        <div className="re-hero-content">
          <p className="re-eyebrow">Rental operations platform</p>
          <h1>Find rooms. Manage rentals. Keep everyone aligned.</h1>
          <p>
            RentEase keeps property discovery, reservations, rent tracking, and guardian access
            organized in one clean workspace.
          </p>
          <div className="re-hero-actions">
            <button type="button" className="re-btn re-btn-gold" onClick={() => navigate('/properties')}>
              Browse Properties
            </button>
            <button type="button" className="re-btn re-btn-outline-light" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      </section>

      <section className="re-trust-strip" aria-label="RentEase trust indicators">
        {liveStats.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>

      <section className="re-section">
        <div className="re-section-heading">
          <div>
            <p className="re-eyebrow">Live availability</p>
            <h2>Start with properties, then compare available rooms</h2>
            {landingData.error && <p className="re-landing-live-note">{landingData.error}</p>}
          </div>
          <Link to="/properties">View all properties</Link>
        </div>
        <div className="re-room-grid">
          {featuredRoomCards.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onReserve={() => navigate(`/rooms/${room.id}`)}
            />
          ))}
        </div>
      </section>

      <section id="about" className="re-feature-rows">
        <article>
          <img src={featureImages.study} alt="Student study desk in a warm room" loading="lazy" />
          <div>
            <p className="re-eyebrow">Property-first search</p>
            <h2>Room details stay clear before anyone reserves</h2>
            <p>
              Browse property type, rates, capacity, amenities, room status, and house rules before
              opening a reservation request.
            </p>
            <ul>
              <li>
                <CheckCircle2 size={18} /> Property-first browsing with room filters
              </li>
              <li>
                <CheckCircle2 size={18} /> Clean room cards with monthly pricing
              </li>
              <li>
                <CheckCircle2 size={18} /> Mobile-friendly room detail pages
              </li>
            </ul>
          </div>
        </article>

        <article>
          <div>
            <p className="re-eyebrow">Managed operations</p>
            <h2>Landlords can track rooms, rent, and requests</h2>
            <p>
              RentEase keeps the day-to-day rental workflow organized, from pending approvals to
              rent status and activity logs.
            </p>
            <ul>
              <li>
                <CalendarCheck size={18} /> Reservation approval workflow
              </li>
              <li>
                <WalletCards size={18} /> Payment and income tracking
              </li>
              <li>
                <ShieldCheck size={18} /> Role-aware dashboard access
              </li>
            </ul>
          </div>
          <img src={featureImages.payments} alt="Payment records on a desk" loading="lazy" />
        </article>

        <article>
          <img src={featureImages.family} alt="Family reviewing housing information" loading="lazy" />
          <div>
            <p className="re-eyebrow">Guardian visibility</p>
            <h2>Share read-only access without exposing controls</h2>
            <p>
              Seekers can generate guardian access links for focused room, reservation, and payment
              status visibility without landlord-only tools.
            </p>
            <ul>
              <li>
                <MessageCircle size={18} /> Guardian links from seeker accounts
              </li>
              <li>
                <Building2 size={18} /> Room and property overview
              </li>
              <li>
                <ShieldCheck size={18} /> Minimal, secure interface
              </li>
            </ul>
          </div>
        </article>
      </section>

      <section className="re-stats-band">
        {liveStats.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>

      <section className="re-section">
        <div className="re-section-heading centered">
          <p className="re-eyebrow">Workflow</p>
          <h2>A simple path from listing to occupancy</h2>
        </div>
        <div className="re-platform-grid">
          {workflowItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="re-platform-card">
                <Icon size={22} />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="contact" className="re-cta-band">
        <div>
          <p className="re-eyebrow">Support</p>
          <h2>Need help with RentEase setup or account access?</h2>
          <a className="re-support-email" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </div>
        <button type="button" className="re-btn re-btn-gold" onClick={() => navigate('/properties')}>
          Browse Properties
        </button>
      </section>

      <section className="re-section re-faq-section">
        <div className="re-section-heading centered">
          <p className="re-eyebrow">FAQ</p>
          <h2>Questions before getting started</h2>
        </div>
        <div className="re-faq-list">
          {faqs.map((faq, index) => (
            <article key={faq.question} className={openFaq === index ? 'is-open' : ''}>
              <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                <span>{faq.question}</span>
                <ChevronDown size={20} />
              </button>
              <div>
                <p>{faq.answer}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="re-footer">
        <div>
          <h3>RentEase</h3>
          <p>Rental management for seekers, guardians, and property operators.</p>
        </div>
        <div>
          <h4>Quick Links</h4>
          <Link to="/properties">Properties</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
        <div>
          <h4>Contact</h4>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </div>
      </footer>
    </main>
  );
}
