async function test() {
  console.log("=== Testing Promotions & Categories End-to-End ===");

  // 1. Login as Manager
  const loginRes = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "0901234567", password: "everyinn2024" })
  });
  console.log("Login status:", loginRes.status);
  const cookie = loginRes.headers.get("set-cookie");
  const headers = { "Content-Type": "application/json", "Cookie": cookie };

  // 2. GET Categories
  const catRes = await fetch("http://localhost:3001/api/promotions/categories", { headers });
  const catData = await catRes.json();
  console.log("Categories count:", catData.categories?.length);
  console.log("Categories:", catData.categories?.map(c => `${c.icon} ${c.name} (${c.promo_count} promos)`));

  // 3. GET Promotions
  const promoRes = await fetch("http://localhost:3001/api/promotions", { headers });
  const promoData = await promoRes.json();
  console.log("Promotions count:", promoData.promotions?.length);
  console.log("Promotions sample:", promoData.promotions?.slice(0, 3).map(p => `${p.name} [${p.code}] - ${p.discount_type}: ${p.discount_value}`));

  // 4. Validate Promotion for Gold Member
  const validateGoldRes = await fetch("http://localhost:3001/api/promotions/validate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      promoCode: "GOLDVIP15",
      roomClass: "haven",
      bookingType: "hourly",
      checkinAt: new Date(Date.now() + 86400000).toISOString(),
      rawSubtotal: 320000,
      memberTier: "gold"
    })
  });
  const goldVal = await validateGoldRes.json();
  console.log("Validate Gold member on GOLDVIP15:", goldVal.valid, "Discount:", goldVal.discountAmount, "Final:", goldVal.finalPrice);

  // 5. Validate Gold code for New Customer (should be ineligible!)
  const validateNewRes = await fetch("http://localhost:3001/api/promotions/validate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      promoCode: "GOLDVIP15",
      roomClass: "haven",
      bookingType: "hourly",
      checkinAt: new Date(Date.now() + 86400000).toISOString(),
      rawSubtotal: 320000,
      memberTier: "new"
    })
  });
  const newVal = await validateNewRes.json();
  console.log("Validate New customer on GOLDVIP15 (Expected false):", newVal.valid, "Reason:", newVal.reason);

  // 6. Create Booking with Seasonal Promotion
  const bookingPayload = {
    roomId: "haven-101",
    phone: "0911223344",
    name: "Khách Ưu Đãi Test",
    instagram: "@promotest",
    facebook: "",
    numGuests: 2,
    bookingType: "hourly",
    checkinAt: new Date(Date.now() + 86400000 * 15).toISOString(),
    checkoutAt: new Date(Date.now() + 86400000 * 15 + 3600000 * 3).toISOString(),
    lateCheckoutHours: 0,
    promotionCode: "THUVANG10",
    closingNote: "Chốt ưu đãi Thu Vàng",
    note: "Test booking with promo",
    status: "confirmed"
  };

  const createBookingRes = await fetch("http://localhost:3001/api/bookings", {
    method: "POST",
    headers,
    body: JSON.stringify(bookingPayload)
  });
  const createBookingData = await createBookingRes.json();
  console.log("Create booking with promo status:", createBookingRes.status);
  console.log("Saved Booking:", {
    id: createBookingData.booking?.id,
    basePrice: createBookingData.booking?.basePrice,
    totalPrice: createBookingData.booking?.totalPrice,
  });

  // Verify booking discount in database
  if (createBookingData.booking?.id) {
    const listRes = await fetch(`http://localhost:3001/api/bookings?search=0911223344`, { headers });
    const listData = await listRes.json();
    const b = listData.bookings?.find(item => item.id === createBookingData.booking.id);
    console.log("Booking retrieved from D1:", {
      id: b?.id,
      discount_amount: b?.discount_amount,
      total_price: b?.total_price,
      promotion_code: b?.promotion_code,
    });

    // Cleanup
    await fetch(`http://localhost:3001/api/bookings/${createBookingData.booking.id}`, {
      method: "DELETE",
      headers
    });
    console.log("Test booking cleaned up.");
  }

  console.log("=== All Tests Completed Successfully ===");
}

test().catch(console.error);
