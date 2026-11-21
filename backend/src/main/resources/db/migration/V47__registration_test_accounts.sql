CREATE TABLE bb_registration_test_account (
    user_id BIGINT PRIMARY KEY REFERENCES bb_user(id) ON DELETE CASCADE,
    username VARCHAR(40) NOT NULL,
    email VARCHAR(254) NOT NULL
);
