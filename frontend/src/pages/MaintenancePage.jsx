import { Settings } from 'lucide-react';

function MaintenancePage() {
  return (
    <main className="maintenance-page">
      <section className="maintenance-panel">
        <div className="maintenance-logo">RentEase</div>
        <Settings size={64} className="maintenance-icon" aria-hidden="true" />
        <h1>We'll be right back</h1>
        <p>
          RentEase is currently undergoing scheduled maintenance. Please check back shortly.
        </p>
        <p className="maintenance-contact">For urgent concerns, contact the administrator.</p>
        <footer>RentEase - Boarding House Rental Management System</footer>
      </section>
    </main>
  );
}

export default MaintenancePage;
