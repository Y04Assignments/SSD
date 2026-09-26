//@ts-nocheck
/// <reference types="jest" />
import { jest, describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

// Mock functions
const mockSave = jest.fn();
const mockDeleteOne = jest.fn();
const mockFind = jest.fn();
const mockFindById = jest.fn();

// ESM Mock for SellRequest model
jest.unstable_mockModule('../src/models/SellRequest.js', () => {
  // Constructor mock
  const MockSellRequest = jest.fn(function (init) {
    Object.assign(this, init);
    this.save = mockSave;
    this.deleteOne = mockDeleteOne;
  });
  // Static methods
  MockSellRequest.find = mockFind;
  MockSellRequest.findById = mockFindById;
  return { __esModule: true, default: MockSellRequest };
});

let controllers;
beforeAll(async () => {
  controllers = await import('../src/controllers/sellRequestController.js');
});

afterAll(() => jest.resetAllMocks());

// Mock Express response
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock Express request
const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  user: { _id: 'user123' },
  ...overrides,
});

describe('SellRequest Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createSellRequest should create a sell request successfully', async () => {
    const req = mockReq({
      body: { energyAmount: 10, comment: 'Test comment', location: { coordinates: [80, 7] } },
    });
    const res = mockRes();

    mockSave.mockResolvedValue({
      _id: 'req123',
      energyAmount: 10,
      location: { type: 'Point', coordinates: [80, 7] },
      comment: 'Test comment',
    });

    await controllers.createSellRequest(req, res);

    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Sell request created successfully',
        request: expect.any(Object),
      })
    );
  });

  test('getUserSellRequests should return user sell requests', async () => {
    const req = mockReq();
    const res = mockRes();

    const mockRequests = [{ _id: 'req1' }, { _id: 'req2' }];
    mockFind.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockRequests) });

    await controllers.getUserSellRequests(req, res);

    expect(mockFind).toHaveBeenCalledWith({ resident: 'user123' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'User sell requests retrieved successfully',
        requests: mockRequests,
      })
    );
  });

  test('updateSellRequest should update a sell request successfully', async () => {
    const req = mockReq({
      params: { id: 'req123' },
      body: { energyAmount: 15, comment: 'Updated', location: { coordinates: [80, 7] } },
    });
    const res = mockRes();

    const mockRequestDoc = {
      resident: 'user123',
      status: 'Pending',
      save: mockSave,
    };
    mockFindById.mockResolvedValue(mockRequestDoc);
    mockSave.mockResolvedValue({ ...mockRequestDoc, energyAmount: 15, comment: 'Updated' });

    await controllers.updateSellRequest(req, res);

    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Sell request updated successfully',
        request: expect.any(Object),
      })
    );
  });

  test('deleteSellRequest should delete a sell request successfully', async () => {
    const req = mockReq({ params: { id: 'req123' } });
    const res = mockRes();

    const mockRequestDoc = {
      resident: 'user123',
      status: 'Pending',
      deleteOne: mockDeleteOne.mockResolvedValue(true),
    };
    mockFindById.mockResolvedValue(mockRequestDoc);

    await controllers.deleteSellRequest(req, res);

    expect(mockDeleteOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Sell request deleted successfully' });
  });

  test('V08: getActiveSellRequests omits resident PII and truncates coordinates to 2 decimal places', async () => {
    const req = mockReq(); // Unauthenticated context is fine for this endpoint
    const res = mockRes();

    // Mock the raw requests returned by DB
    const mockRawRequests = [{
      _id: 'req_v08',
      energyAmount: 50,
      location: { type: 'Point', coordinates: [80.123456, 7.654321] },
      comment: 'Selling solar',
      status: 'Pending',
      createdAt: '2023-01-01',
      resident: { name: 'Secret User', email: 'secret@secret.com' } // PII that should be stripped
    }];

    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockRawRequests)
        })
      })
    });

    await controllers.getActiveSellRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonArgs = res.json.mock.calls[0][0];
    expect(jsonArgs.message).toMatch(/Active sell requests retrieved successfully/);
    
    const returnedRequest = jsonArgs.requests[0];
    
    // 1. Verify exact coordinates are truncated to 2 decimals
    expect(returnedRequest.location.coordinates[0]).toBe(80.12);
    expect(returnedRequest.location.coordinates[1]).toBe(7.65);
    
    // 2. Verify resident object is stripped and replaced with generic username
    expect(returnedRequest.resident).toBeUndefined();
    expect(returnedRequest.username).toMatch(/Solar Seller/);
  });
});
