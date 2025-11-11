import React, { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { checkUserRestrictions, getUserModerationHistory } from "../services/moderationService";
import { StrikeConfig } from "../utils/constants";

const UserRestrictionBanner = () => {
  const { currentUser, userData } = useAuth();
  const [restrictions, setRestrictions] = useState([]);
  const [strikes, setStrikes] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchUserStatus();
    }
  }, [currentUser]);

  const fetchUserStatus = async () => {
    try {
      // Check for active restrictions
      const restrictionData = await checkUserRestrictions(currentUser.uid);
      setRestrictions(restrictionData.restrictions);

      // Get moderation history
      const history = await getUserModerationHistory(currentUser.uid);
      setStrikes(history.strikes);
    } catch (error) {
      console.error("Error fetching user status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || (!restrictions.length && !strikes.length)) {
    return null;
  }

  // Check if user is currently suspended
  const isSuspended = userData?.status === "suspended";
  const suspendedUntil = userData?.suspendedUntil?.toDate
    ? userData.suspendedUntil.toDate()
    : null;

  // Get active posting restriction
  const postingRestriction = restrictions.find(
    (r) => r.restrictionType === "posting" && r.isActive
  );

  if (!isSuspended && !postingRestriction && strikes.length === 0) {
    return null;
  }

  return (
    <>
      {/* Suspension Banner (most severe) */}
      {isSuspended && (
        <div className="bg-red-600 text-white px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">Account Suspended</p>
                <p className="text-sm text-red-100">
                  Your account has been suspended
                  {suspendedUntil && ` until ${suspendedUntil.toLocaleDateString()}`}. You cannot
                  access the platform during this time.
                </p>
                {userData?.suspensionReason && (
                  <p className="text-sm text-red-100 mt-1">
                    Reason: {userData.suspensionReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posting Restriction Banner */}
      {!isSuspended && postingRestriction && (
        <div className="bg-orange-600 text-white px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Posting Restricted</p>
                <p className="text-sm text-orange-100">
                  You cannot post or comment until{" "}
                  {postingRestriction.endsAt?.toDate
                    ? postingRestriction.endsAt.toDate().toLocaleDateString()
                    : "further notice"}
                  . You can still view content.
                </p>
                {postingRestriction.reason && (
                  <p className="text-sm text-orange-100 mt-1">
                    Reason: {postingRestriction.reason}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strike Warning Banner (least severe, info only) */}
      {!isSuspended && !postingRestriction && strikes.length > 0 && strikes.length < 3 && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-yellow-900">
                  Community Guidelines Warning - Strike {strikes.length}/3
                </p>
                <p className="text-sm text-yellow-800">
                  Your content violated community guidelines. Future violations may result in
                  account restrictions.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-yellow-700 hover:text-yellow-900 text-sm font-medium"
            >
              {showDetails ? "Hide" : "View"} Details
            </button>
          </div>

          {/* Strike Details (expandable) */}
          {showDetails && (
            <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-yellow-200">
              <div className="space-y-2">
                {strikes.slice(0, 3).map((strike, idx) => {
                  const strikeConfig = StrikeConfig[strike.strikeLevel];
                  const strikeDate = strike.issuedAt?.toDate
                    ? strike.issuedAt.toDate()
                    : new Date(strike.issuedAt);

                  return (
                    <div
                      key={idx}
                      className="bg-white border border-yellow-300 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{strikeConfig?.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            Strike {strike.strikeLevel} - {strike.violationType}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{strike.explanation}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            Issued on {strikeDate.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default UserRestrictionBanner;
