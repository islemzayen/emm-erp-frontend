import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush  = vi.fn();
const mockLogin = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin, user: null }),
}));

vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        emailLabel:         "Email",
        emailPlaceholder:   "Enter your email",
        passwordLabel:      "Password",
        signInButton:       "Sign In →",
        signInTitle:        "Sign In",
        authLabel:          "Authentication",
        erpSubtitle:        "EMM ERP",
        erpTagline:         "Manage your operations",
        copyright:          "© EMM Hardware",
        invalidCredentials: "Invalid email or password",
        signingIn:          "SIGNING IN...",
      };
      return map[key] ?? key;
    },
  }),
}));

// Mock axios api — your page uses api.post("/auth/login")
vi.mock("@/services/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

import LoginPage from "../app/login/page";
import api from "../services/api";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password inputs", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("renders the sign in button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders the EMM logo", () => {
    render(<LoginPage />);
    expect(screen.getByAltText("EMM Logo")).toBeInTheDocument();
  });

  it("updates email and password fields on input", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput    = screen.getByPlaceholderText("Enter your email");
    const passwordInput = screen.getByPlaceholderText("••••••••");

    await user.type(emailInput, "hr@erp.com");
    await user.type(passwordInput, "123456");

    expect(emailInput).toHaveValue("hr@erp.com");
    expect(passwordInput).toHaveValue("123456");
  });

  it("calls api.post with correct credentials on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        user: { id: "1", name: "HR Manager", email: "hr@erp.com", role: "HR_MANAGER" },
        token: "fake-token",
      },
    });

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "hr@erp.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "123456");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/login", {
        email: "hr@erp.com",
        password: "123456",
      });
    });
  });

  it("redirects to /dashboard/hr for HR_MANAGER role", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        user: { id: "1", name: "HR Manager", email: "hr@erp.com", role: "HR_MANAGER" },
        token: "fake-token",
      },
    });

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "hr@erp.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "123456");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard/hr");
    });
  });

  it("redirects to correct dashboard for each role", async () => {
    const roles = [
      { role: "ADMIN",              path: "/dashboard/admin"      },
      { role: "MARKETING_MANAGER",  path: "/dashboard/marketing"  },
      { role: "SALES_MANAGER",      path: "/dashboard/sales"      },
      { role: "STOCK_MANAGER",      path: "/dashboard/stock"      },
      { role: "FINANCE_MANAGER",    path: "/dashboard/finance"    },
      { role: "PURCHASE_MANAGER",   path: "/dashboard/achat"      },
    ];

    for (const { role, path } of roles) {
      vi.clearAllMocks();
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { user: { id: "1", name: "User", email: "u@erp.com", role }, token: "t" },
      });

      const { unmount } = render(<LoginPage />);
      const user = userEvent.setup();

      await user.type(screen.getByPlaceholderText("Enter your email"), "u@erp.com");
      await user.type(screen.getByPlaceholderText("••••••••"), "123456");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(path);
      });
      unmount();
    }
  });

  it("shows error message on failed login", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { message: "Invalid email or password" } },
    });

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "wrong@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it("disables button while signing in", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockImplementationOnce(() => new Promise(() => {}));

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "hr@erp.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "123456");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    });
  });
});