import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import RequireRole from "@/components/auth/RequireRole";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Search from "./pages/Search.tsx";
import Book from "./pages/Book.tsx";
import BookingConfirm from "./pages/BookingConfirm.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import CompanyDashboard from "./pages/CompanyDashboard.tsx";
import PrintTicket from "./pages/PrintTicket.tsx";
import ContactUs from "./pages/ContactUs.tsx";
import Offers from "./pages/Offers.tsx";
import SendParcel from "./pages/SendParcel.tsx";
import TrackParcel from "./pages/TrackParcel.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/search" element={<Search />} />
            <Route path="/book/:tripId" element={<Book />} />
            <Route path="/booking/:id" element={<BookingConfirm />} />
            <Route path="/print-ticket" element={<PrintTicket />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/offers" element={<Offers />} />
            <Route path="/send-parcel" element={<SendParcel />} />
            <Route path="/track-parcel" element={<TrackParcel />} />
            <Route path="/admin" element={<RequireRole roles={["super_admin"]}><AdminDashboard /></RequireRole>} />
            <Route path="/company" element={<RequireRole roles={["company_admin","cashier","parcel_clerk","driver","conductor"]}><CompanyDashboard /></RequireRole>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
