import React, { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Loader2 } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";

export default function PlaidConnectButton({ onLinked, className, children }) {
  const [linkToken, setLinkToken] = useState(null);
  const [fetching, setFetching] = useState(false);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      const institutionName = metadata?.institution?.name;
      try {
        const { data } = await api.post("/plaid/exchange", {
          public_token,
          institution_name: institutionName,
        });
        toast.success(
          `Connected ${institutionName || "your account"} — imported ${data.imported} debt${
            data.imported === 1 ? "" : "s"
          }.`
        );
        onLinked?.(data);
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to finish linking your account.");
      } finally {
        setLinkToken(null);
      }
    },
    onExit: (err) => {
      if (err) toast.error(err.display_message || "Bank connection was cancelled.");
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const startLink = async () => {
    setFetching(true);
    try {
      const { data } = await api.post("/plaid/link-token");
      setLinkToken(data.link_token);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Couldn't start bank connection.");
    } finally {
      setFetching(false);
    }
  };

  return (
    <button
      type="button"
      onClick={startLink}
      disabled={fetching}
      className={className}
      data-testid="plaid-connect-btn"
    >
      {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
