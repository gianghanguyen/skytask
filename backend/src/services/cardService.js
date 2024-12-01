import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { boardModel } from '~/models/boardModel'
import ApiError from '~/utils/ApiError'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { StatusCodes } from 'http-status-codes'
import { validateCardOwners } from '~/utils/helperMethods'
import { ObjectId } from 'mongodb'

const createNew = async (reqBody) => {
  try {
    const newCard = {
      ...reqBody
    }
    const createdCard = await cardModel.createNew(newCard)
    const getNewCard = await cardModel.findOneById(createdCard.insertedId)

    if (getNewCard) {
      await columnModel.pushCardOrderIds(getNewCard)
    }

    return getNewCard
  } catch (error) {
    throw error
  }
}

const update = async (cardId, reqBody, cardCoverFile, userInfo) => {
  try {
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }
    let updatedCard = {}

    if (cardCoverFile) {
      // Trường hợp đẩy ảnh lên Cloudinary
      const uploadResult = await CloudinaryProvider.streamUpload(cardCoverFile.buffer, 'card-covers')
      // Lưu lại url của cái file ảnh vào trong database
      updatedCard = await cardModel.update(cardId, { cover: uploadResult.secure_url })
    } else if (updateData.commentToAdd) {
      // Tạo dữ liệu comment để thêm vào Database, cần bổ sung thêm những field cần thiết
      const commentData = {
        ...updateData.commentToAdd,
        commentedAt: Date.now(),
        userId: userInfo._id,
        userEmail: userInfo.email
      }
      updatedCard = await cardModel.unshiftNewComment(cardId, commentData)
    } else if (updateData.incomingMemberInfo) {
      // Trường hợp ADD hoặc REMOVE thành viên ra khỏi Card
      updatedCard = await cardModel.updateMembers(cardId, updateData.incomingMemberInfo)
    } else {
      // Các trường hợp update chung như title, description, ...
      updatedCard = await cardModel.update(cardId, updateData)
    }

    return updatedCard
  } catch (error) { throw error }
}

const deleteItem = async (cardId) => {
  try {
    const targetCard = await cardModel.findOneById(cardId)
    if (!targetCard) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found!')
    }

    await cardModel.deleteItem(cardId)

    await columnModel.pullCardOrderIds(targetCard)

    return true
  } catch (error) { throw error }
}


const createChecklist = async (user, cardId, title) => {
  try {
    const newChecklist = { title, items: [] };

    // Convert the cardId to an ObjectId
    const cardIdObj = new ObjectId(cardId);
    // Fetch the card, column, and board
    const card = await cardModel.findOneById(cardIdObj);
    const columnIdObj = new ObjectId(card.columnId);
    await columnModel.findOneById(columnIdObj);
    const boardIdObj = new ObjectId(card.boardId);
    await boardModel.findOneById(boardIdObj);

    const validateOwner = await validateCardOwners(cardIdObj, columnIdObj, boardIdObj, user);

    if (!validateOwner) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to create checklist!');
    }

    // Add the checklist to the card
    const updatedCard = await cardModel.createChecklist(cardId, newChecklist);

    return updatedCard;
  } catch (error) {
    throw error;
  }
}

const addChecklistItem = async (user, cardId, checklistId, text) => {
  try {
    // Chuyển đổi cardId và checklistId sang ObjectId
    const cardIdObj = new ObjectId(cardId);
    const checklistIdObj = new ObjectId(checklistId);

    // Lấy thông tin card, column, và board liên quan
    const card = await cardModel.findOneById(cardIdObj);
    const columnIdObj = new ObjectId(card.columnId);
    await columnModel.findOneById(columnIdObj);
    const boardIdObj = new ObjectId(card.boardId);
    await boardModel.findOneById(boardIdObj);

    // Kiểm tra quyền sở hữu
    const validateOwner = await validateCardOwners(cardIdObj, columnIdObj, boardIdObj, user);

    if (!validateOwner) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to add checklist item!');
    }

    // Tạo đối tượng checklist item mới
    const newChecklistItem = {
      id: new ObjectId(),
      text,
      completed: false,
      createdAt: Date.now(),
      createdBy: user._id
    };

    // Thêm checklist item vào checklist cụ thể trong card
    const updatedCard = await cardModel.addChecklistItem(cardIdObj, checklistIdObj, newChecklistItem);

    return updatedCard;
  } catch (error) {
    throw error;
  }
};

const deleteChecklist = async (user, cardId, checklistId) => {
  try {
    // Chuyển đổi cardId và checklistId sang ObjectId
    const cardIdObj = new ObjectId(cardId);
    const checklistIdObj = new ObjectId(checklistId);

    // Lấy thông tin card, column, và board liên quan
    const card = await cardModel.findOneById(cardIdObj);
    const columnIdObj = new ObjectId(card.columnId);
    await columnModel.findOneById(columnIdObj);
    const boardIdObj = new ObjectId(card.boardId);
    await boardModel.findOneById(boardIdObj);

    // Kiểm tra quyền sở hữu
    const validateOwner = await validateCardOwners(cardIdObj, columnIdObj, boardIdObj, user);

    if (!validateOwner) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to delete checklist item!');
    }

    // Xóa checklist khỏi card
    const updatedCard = await cardModel.deleteChecklist(cardIdObj, checklistIdObj);
    return updatedCard;

  } catch (error) {
    throw error;
  }
};


export const cardService = {
  createNew,
  update,
  deleteItem,
  createChecklist,
  deleteChecklist,
  addChecklistItem
}
