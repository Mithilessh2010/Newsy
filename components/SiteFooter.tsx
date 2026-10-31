import Link from 'next/link';
const groups = [
    { title: 'Discover', links: [['News', '/news'], ['Around the world', '/explore'], ['Public records', '/records'], ['Timelines', '/timelines']] },
    { title: 'Equal Horizons', links: [['About the project', '/about'], ['Your account', '/account'], ['Saved stories', '/saved']] },
];
export function SiteFooter() {
    return (<footer className="eh-shell-footer">
      <div className="eh-footer-top">
        <div className="eh-footer-identity">
          <Link href="/">equal horizons<span>.</span></Link>
          <p>A more complete picture of the places that shape our world.</p>
        </div>
        <div className="eh-footer-groups">
          {groups.map(group => (<div key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            </div>))}
          <div>
            <h2>Get in touch</h2>
            <a href="https://www.equalhorizons.tech/" target="_blank" rel="noopener noreferrer">Our nonprofit ↗</a>
            <a href="mailto:equalhorizonsinc@gmail.com">Email us ↗</a>
            <a href="https://github.com/Mithilessh2010/Newsy" target="_blank" rel="noopener noreferrer">Source code ↗</a>
          </div>
        </div>
      </div>
      <div className="eh-footer-bottom"><span>© {new Date().getFullYear()} Equal Horizons</span><span>Independent information. Original sources.</span></div>
    </footer>);
}
