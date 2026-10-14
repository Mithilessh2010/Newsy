import './globals.css';
import type {Metadata} from 'next';
import {Provider} from '@/components/Provider';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
export const metadata:Metadata={title:{default:'Equal Horizons — Your community. The whole picture.',template:'%s | Equal Horizons'},description:'Local news and worldwide public information, personalized to your city. From fresh headlines to a growing historical archive. An open-source public knowledge project.',metadataBase:new URL('https://www.equalhorizons.tech'),openGraph:{title:'Equal Horizons — Worldwide public knowledge',description:'Know what is happening. Understand what happened before.',type:'website'},robots:{index:true,follow:true}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><Provider><SiteHeader/><main id="main-content">{children}</main><SiteFooter/></Provider></body></html>}
