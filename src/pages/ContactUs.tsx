import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, MessageSquare } from "lucide-react";

const ContactUs = () => {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="bg-gradient-to-r from-primary to-rose-600 py-16 text-primary-foreground">
        <div className="container text-center">
          <h1 className="text-4xl font-extrabold md:text-5xl">Need Help?</h1>
          <p className="mt-3 opacity-95">We're here to assist you 24/7</p>
        </div>
      </section>

      <section className="container mt-12 grid gap-6 md:grid-cols-3">
        <ContactCard icon={<Phone className="h-7 w-7" />} title="Call Us" body="Speak directly with our customer support team" lines={["+254 709 215 215", "+254 785 700 700"]} />
        <ContactCard icon={<Mail className="h-7 w-7" />} title="Email Support" body="Send us an email and we'll respond within 24 hours" lines={["hello@roadlink.africa"]} />
        <ContactCard icon={<MessageSquare className="h-7 w-7" />} title="Send Message" body="Fill out our contact form and we'll get back to you" lines={["Contact Form"]} />
      </section>

      <div className="mt-16 h-12 bg-secondary" />
    </div>
  );
};

const ContactCard = ({ icon, title, body, lines }: { icon: React.ReactNode; title: string; body: string; lines: string[] }) => (
  <Card className="shadow-card">
    <CardContent className="flex flex-col items-center p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">{icon}</div>
      <div className="mt-4 text-lg font-bold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-4 space-y-1">
        {lines.map((l) => <div key={l} className="font-semibold text-secondary">{l}</div>)}
      </div>
    </CardContent>
  </Card>
);

export default ContactUs;
