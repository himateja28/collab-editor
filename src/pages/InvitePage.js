import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../services/api";

const InvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/documents/invite/${token}`);
        setInvite(r.data);
      } catch (e) {
        setError(e.response?.data?.message || "Unable to open invite link.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const accept = async () => {
    setJoining(true); setError("");
    try {
      const r = await api.post(`/documents/invite/${token}/accept`);
      navigate(`/documents/${r.data.id}`);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to join.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div id="invite-page">
      <Navbar />
      <main className="invite-page">
        <section className="invite-card" id="invite-card">
          {loading ? (
            <div className="loading-block"><span className="spinner spinner--lg" />Loading invite…</div>
          ) : invite ? (
            <>
              <h1>📨 You're Invited</h1>
              <p>You were invited to <strong>{invite.title}</strong> by <strong>{invite.owner?.name || "a collaborator"}</strong>.</p>
              <p>Access level: <strong>{invite.inviteRole}</strong></p>
              <button className="btn btn-primary" disabled={joining} onClick={accept} style={{ justifySelf: "start" }}>
                {joining ? <><span className="spinner" /> Joining…</> : "Join Document"}
              </button>
            </>
          ) : null}
          {error && <div className="error-box">{error}</div>}
        </section>
      </main>
    </div>
  );
};

export default InvitePage;
