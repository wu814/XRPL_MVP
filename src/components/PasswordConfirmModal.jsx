<div className="fixed inset-0 z-20 flex items-center justify-center bg-stone-950/50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                        <h2 className="text-xl font-bold mb-4 text-center">
                            Confirm Deletion
                        </h2>
                        {/* <p className="mb-6">
                            Are you sure you want to remove this wallet from dashboard?
                            <br />
                            <span className="font-bold">Classic Address: {classic_address}</span>
                        </p> */}
                        <p className="mb-4 text-center">
                            Please enter the admin password to confirm deletion.
                        </p>
                        <input
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 mb-4"
                            placeholder="Admin Password"
                        />
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="cancel"
                                onClick={() => setShowConfirm(false)}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="submit"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                {loading ? "Deleting..." : "Delete"}
                            </Button>
                        </div>
                    </div>
                </div>