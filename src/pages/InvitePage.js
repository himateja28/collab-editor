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
    const loadInvite = async () => {
      try {
        const response = await api.get(`/documents/invite/${token}`);
        setInvite(response.data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to open invite link.");
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  const acceptInvite = async () => {
    try {
      setJoining(true);
      setError("");
      const response = await api.post(`/documents/invite/${token}/accept`);
      navigate(`/documents/${response.data.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to join document.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="page-shell">
      <Navbar />
      <main className="invite-layout">
        <section className="invite-card">
          {loading ? <p>Loading invite...</p> : null}

          {!loading && invite ? (
            <>
              <h1>Document Invite</h1>
              <p>
                You were invited to <strong>{invite.title}</strong> by{" "}
                <strong>{invite.owner?.name || "a collaborator"}</strong>.
              </p>
              <p>Your access after joining: {invite.inviteRole}</p>
              <button className="primary-btn" disabled={joining} onClick={acceptInvite} type="button">
                {joining ? "Joining..." : "Join Document"}
              </button>
            </>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </main>
    </div>
  );
};

export default InvitePage;
