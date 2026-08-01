import { redirect } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import SmoothScroll from "@/components/SmoothScroll";
import GsapRefresher from "@/components/GsapRefresher";
import ScrollProgressBar from "@/components/ui/ScrollProgressBar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Manifesto from "@/components/sections/Manifesto";
import Board from "@/components/sections/Board";
import Teams from "@/components/sections/Teams";
import Events from "@/components/sections/Events";
// Gallery is hidden until we have real photos to put in it. To restore:
// re-add <Gallery /> below and the "gallery" entry in NAV_LINKS (lib/data.ts).
// import Gallery from "@/components/sections/Gallery";
import Membership from "@/components/sections/Membership";
import Faqs from "@/components/sections/Faqs";
import Contact from "@/components/sections/Contact";
import { fetchMe } from "@/lib/serverMe";

export const dynamic = "force-dynamic";

export default async function Home() {
  // An officer with a live session or a valid "remember me" cookie lands
  // straight in the admin instead of the marketing page — the same check
  // the (admin) layout gates on, so a remembered device never has to click
  // Sign In again just to get back in.
  const me = await fetchMe();
  if (me) redirect(me.user.mustChangePassword ? "/change-password" : "/admin");

  return (
    <>
      <LoadingScreen />
      <SmoothScroll />
      <GsapRefresher />
      <ScrollProgressBar />
      <Navbar />
      <main>
        <Hero />
        <About />
        <Manifesto />
        <Board />
        <Teams />
        <Events />
        <Membership />
        <Faqs />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
